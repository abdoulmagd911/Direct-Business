-- v2 foundation, part 1 (P3-1a): schemas, privileges, the page-level type, the clock and Riyadh dates, numbering.
-- TECH-SPEC §3.0, rules A6 and A8. Forward-only: once merged this file never changes; fix forward (V103).

-- ---------------------------------------------------------------- schemas
-- `api` is the only schema PostgREST exposes (read views and write functions). The others are private: business tables
-- live there, and a signed-in person reaches them only through `api`. Module schemas (partner, finance, work, perf,
-- report, appraisal, io) are created by the step that fills them.
create schema core;      -- organisation, people, access, settings, files, notes, numbering
create schema audit;     -- the change log: one request per person action, one change per row
create schema notify;    -- notifications
create schema authz;     -- access helpers called by row rules and write functions
create schema api;       -- the one door
create schema norm;      -- pure folding functions (names, identifiers)
create schema measure;   -- KPI sources

comment on schema api is 'The only schema PostgREST exposes: read views (security_invoker) and write functions (A6).';

-- ---------------------------------------------------------------- privileges (A8)
-- The old app found its functions executable by `anon` after every re-creation, because Postgres grants EXECUTE on a
-- new function to PUBLIC. From here on nothing is executable or readable unless its own migration grants it.
alter default privileges revoke execute on functions from public;
alter default privileges revoke all on tables from public;
alter default privileges revoke all on sequences from public;
-- …and from the API roles, in case the platform's defaults for the migration role ever grant them anything.
alter default privileges revoke all on tables from anon, authenticated, service_role;
alter default privileges revoke all on sequences from anon, authenticated, service_role;
alter default privileges revoke all on functions from anon, authenticated, service_role;
revoke all on schema core, audit, notify, authz, api, norm, measure from public;

-- Signed-in people may look into `api`; `anon` gets nothing at all (M87). Usage of a private schema is granted where
-- something readable first goes into it (core: the date helpers below).
grant usage on schema api to authenticated;

-- ---------------------------------------------------------------- page levels (D2)
create type core.level as enum ('none', 'view', 'own', 'full');
comment on type core.level is 'A person''s level on a page, ordered none < view < own < full (D2).';

-- ---------------------------------------------------------------- the clock and Riyadh dates (D20)
-- Every "now" of the business rules comes from core.clock(), so a test can move time (stale tasks, due dates) by
-- setting v2.test_now inside its own transaction. PostgREST never lets a caller set it: requests carry only their
-- JWT claims and headers.
create function core.clock() returns timestamptz
language sql stable parallel safe set search_path = ''
as $$
  select coalesce(nullif(pg_catalog.current_setting('v2.test_now', true), '')::timestamptz, pg_catalog.now())
$$;
comment on function core.clock() is 'Now, or the test clock v2.test_now when a test sets it in its transaction.';

-- An instant is stored in UTC and belongs to the Riyadh calendar day it falls on (D20). No Hijri anywhere.
create function core.riyadh_day(t timestamptz) returns date
language sql immutable parallel safe set search_path = ''
as $$
  select (t at time zone 'Asia/Riyadh')::date
$$;
comment on function core.riyadh_day(timestamptz) is 'The Riyadh calendar day of an instant (D20).';

create function core.riyadh_today() returns date
language sql stable parallel safe set search_path = ''
as $$
  select core.riyadh_day(core.clock())
$$;
comment on function core.riyadh_today() is 'Today in Riyadh, by core.clock() (D20).';

create function core.month_of(d date) returns date
language sql immutable parallel safe set search_path = ''
as $$
  select pg_catalog.date_trunc('month', d)::date
$$;
comment on function core.month_of(date) is 'The first day of the month holding d.';

create function core.quarter_of(d date) returns date
language sql immutable parallel safe set search_path = ''
as $$
  select pg_catalog.date_trunc('quarter', d)::date
$$;
comment on function core.quarter_of(date) is 'The first day of the calendar quarter holding d (quarters are built from months).';

-- The date helpers are pure and are called by read views that run as the signed-in person.
grant execute on function core.clock(), core.riyadh_day(timestamptz), core.riyadh_today(), core.month_of(date),
  core.quarter_of(date) to authenticated;
grant usage on schema core to authenticated;

-- ---------------------------------------------------------------- numbering (§3.0)
-- People-facing numbers (TSK-2026-0042, PRJ-2026-007) come from one locked counter row per kind and year: the upsert
-- takes the row lock, so two people never draw the same number. Nobody reads or writes the table directly; api.*
-- write functions (security definer, owned by the migration role) call core.next_number.
create table core.counter (
  kind text not null check (kind ~ '^[a-z][a-z0-9_]*$'),
  year int not null check (year between 2000 and 2100),
  last int not null default 0 check (last >= 0),
  primary key (kind, year)
);
alter table core.counter enable row level security;
comment on table core.counter is 'The last number drawn per kind and year; written only by core.next_number().';

create function core.next_number(p_kind text, p_year int) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n int;
begin
  insert into core.counter as c (kind, year, last) values (p_kind, p_year, 1)
  on conflict (kind, year) do update set last = c.last + 1
  returning c.last into n;
  return n;
end
$$;
comment on function core.next_number(text, int) is 'Draws the next number of a kind in a year (1, 2, 3 … no gaps, no repeats).';

create function core.format_number(prefix text, year int, n int, width int default 4) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select prefix || '-' || year::text || '-' || pg_catalog.lpad(n::text, width, '0')
$$;
comment on function core.format_number(text, int, int, int) is 'TSK-2026-0042: prefix, year, number padded to width.';
grant execute on function core.format_number(text, int, int, int) to authenticated;
