-- v2 foundation, part 2 (P3-1b): the change log, the organisation and its access levels, settings, profiles, the
-- System and Import persons, and api.me(). TECH-SPEC §3.1–§3.3, §4, §5; rules A6, A11, A14, A16; D2, D7, D13, V44.
-- Forward-only: once merged this file never changes (V103).

-- ================================================================ the change log (§3.3)
-- One request per person action; one change row per written row, holding only the fields that changed. Nobody reads
-- these tables directly: the history and Activity views come with P3-5/P3-6.
create table audit.request (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid not null,                -- → core.person (below): a person, or the System / Import person (V44)
  kind text not null check (kind in ('ui', 'import', 'job', 'system', 'undo')),
  label_key text,
  label_args jsonb,
  reason text,
  batch_id uuid,                          -- → io.batch, added by P7-1
  undo_of uuid references audit.request (id),
  undone_by uuid references audit.request (id),
  undone_at timestamptz
);
create index audit_request_actor on audit.request (actor_id, at desc);
alter table audit.request enable row level security;
comment on table audit.request is 'One row per person action (or import, job, automatic system write) — §3.3.';

create table audit.change (
  id bigint generated always as identity primary key,
  request_id uuid not null references audit.request (id),
  at timestamptz not null default now(),
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert', 'update', 'remove', 'restore', 'delete')),
  fields text[] not null default '{}',
  before jsonb,
  after jsonb,
  version_after int
);
create index audit_change_row on audit.change (table_name, row_id, id desc);
create index audit_change_request on audit.change (request_id);
alter table audit.change enable row level security;
comment on table audit.change is 'One row per written row: only the changed fields, before and after (A16).';

-- ================================================================ organisation (§3.1)
-- Standard columns (STD): id, created_at, created_by, updated_at, updated_by, version — stamped by audit.stamp(), never
-- by a caller. Soft removal (SOFT): deleted_at, deleted_by, delete_reason; no role holds DELETE on any table.

create table core.department (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (btrim(name_en) <> ''),
  name_ar text,
  head_person_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
comment on table core.department is 'A department (Commercial first); every business row carries one (§2.6).';

create table core.team (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references core.department (id),
  code text not null check (code ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (btrim(name_en) <> ''),
  name_ar text,
  lead_person_id uuid,
  active boolean not null default true,
  retired_at timestamptz,
  retired_into_team_id uuid references core.team (id),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  unique (department_id, code)
);
comment on table core.team is 'A team inside a department; retired, never deleted (D11).';

create table core.role (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (btrim(name_en) <> ''),
  name_ar text,
  sort int not null default 0,
  active boolean not null default true,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1
);
comment on table core.role is 'A role only sets default page levels (D2); an admin role is full everywhere.';

create table core.person (
  id uuid primary key default gen_random_uuid(),
  full_name_en text not null check (btrim(full_name_en) <> ''),
  full_name_ar text,
  nickname_en text,
  nickname_ar text,
  job_title_en text,
  job_title_ar text,
  department_id uuid references core.department (id),
  team_id uuid references core.team (id),
  manager_id uuid references core.person (id),
  role_id uuid references core.role (id),
  can_sign_in boolean not null default false,
  active boolean not null default true,
  joined_on date,
  left_on date,
  kind text not null default 'staff' check (kind in ('staff', 'system')),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text,
  check (kind = 'system' or department_id is not null),
  check (kind = 'staff' or not can_sign_in),
  check (manager_id is distinct from id),
  check (left_on is null or joined_on is null or left_on >= joined_on)
);
comment on table core.person is 'A person, referenced by id everywhere (A11). kind system: the named non-login actors (V44).';

create table core.person_team_assist (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  team_id uuid not null references core.team (id),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index person_team_assist_live on core.person_team_assist (person_id, team_id) where deleted_at is null;
comment on table core.person_team_assist is 'Teams a person helps besides their home team.';

create table core.person_department (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  department_id uuid not null references core.department (id),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index person_department_live on core.person_department (person_id, department_id)
  where deleted_at is null;
comment on table core.person_department is 'Departments an admin lets a person see besides their own (§2.6).';

-- ================================================================ pages, capabilities, levels (§3.1, §5)
-- Pages, capabilities and setting definitions are written by the registry sync (P3-4); role defaults are synced,
-- then edited in the browser; person overrides are the browser's.

create table core.page (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_.]*$'),
  module text not null,
  route text not null,
  nav_group text,
  nav_order int,
  levels_allowed core.level[] not null default '{none,view,own,full}',
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1
);

create table core.capability (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_.]*$'),
  page_key text not null references core.page (key),
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1
);

create table core.role_page_level (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references core.role (id),
  page_key text not null references core.page (key),
  level core.level not null,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index role_page_level_live on core.role_page_level (role_id, page_key) where deleted_at is null;

create table core.role_capability (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references core.role (id),
  capability_key text not null references core.capability (key),
  granted boolean not null,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index role_capability_live on core.role_capability (role_id, capability_key) where deleted_at is null;

-- Per-person overrides: who set one and when are its created_by/updated_by/updated_at; the reason is required.
create table core.person_page_level (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  page_key text not null references core.page (key),
  level core.level not null,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index person_page_level_live on core.person_page_level (person_id, page_key) where deleted_at is null;

create table core.person_capability (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  capability_key text not null references core.capability (key),
  granted boolean not null,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index person_capability_live on core.person_capability (person_id, capability_key)
  where deleted_at is null;

-- ================================================================ sign-in link and profile (§4, §3.1)
-- core.person_auth is here (not P3-2) because api.me() resolves the person through it; P3-2 fills it from the
-- allow-list and adds core.person_email and core.sign_in_log (V107).
create table core.person_auth (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  person_id uuid not null references core.person (id),
  email text,
  providers text[] not null default '{}',
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1
);
comment on table core.person_auth is 'Each Supabase identity resolves to exactly one person; a door never makes a person (§4).';

create table core.person_profile (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references core.person (id),
  display_name_en text,
  display_name_ar text,
  avatar_file_id uuid,                    -- → core.file, added by P3-8
  avatar_color text check (avatar_color in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')),
  badge_kind text not null default 'none' check (badge_kind in ('none', 'icon', 'zodiac')),
  badge_value text,
  theme text check (theme in ('light', 'dark', 'colorful', 'direct')),
  density text check (density in ('comfortable', 'compact')),
  locale text check (locale in ('en', 'ar')),
  start_page text references core.page (key),
  drawer_pinned boolean,
  notify jsonb,
  seen jsonb,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  check (
    (badge_kind = 'none' and badge_value is null)
    or (badge_kind = 'icon' and badge_value ~ '^[a-z0-9-]+$')
    or (badge_kind = 'zodiac' and badge_value in ('aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra',
                                                 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'))
  )
);
comment on table core.person_profile is '"My profile" (V9): each person edits their own; a null field takes the default.';

-- ================================================================ settings (§3.2)
create table core.setting_def (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*\.[a-z0-9_.]+$'),
  group_page text not null references core.page (key),
  schema jsonb not null,
  default_value jsonb,
  effective_dated boolean not null default false,
  label_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1
);
comment on table core.setting_def is 'A setting''s definition, synced from the registry (P3-4).';

-- A change is a new dated row, never an update: history and "as of" reads come free (§5a). Removal (for Undo) is soft.
create table core.setting (
  id uuid primary key default gen_random_uuid(),
  key text not null references core.setting_def (key),
  department_id uuid references core.department (id),   -- null: the whole company
  value jsonb not null,
  valid_from date not null,
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid, delete_reason text
);
create unique index setting_one_per_date on core.setting (key, department_id, valid_from) nulls not distinct
  where deleted_at is null;
comment on table core.setting is 'Setting values by date and department (null = company-wide); rows never change in place.';

create table core.wording (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('en', 'ar')),
  key text not null,
  text text not null,
  created_at timestamptz not null default now(), created_by uuid not null, updated_at timestamptz, updated_by uuid,
  version int not null default 1,
  unique (locale, key)
);
comment on table core.wording is 'Settings → App → Wording: overrides of the message catalogs.';

-- ================================================================ references between them
alter table core.department add foreign key (head_person_id) references core.person (id);
alter table core.team add foreign key (lead_person_id) references core.person (id);
alter table audit.request add foreign key (actor_id) references core.person (id);
do $$
declare
  t text;
begin
  foreach t in array array['core.department', 'core.team', 'core.role', 'core.person', 'core.person_team_assist',
    'core.person_department', 'core.page', 'core.capability', 'core.role_page_level', 'core.role_capability',
    'core.person_page_level', 'core.person_capability', 'core.person_auth', 'core.person_profile',
    'core.setting_def', 'core.setting', 'core.wording']
  loop
    execute format('alter table %s add foreign key (created_by) references core.person (id)', t);
    execute format('alter table %s add foreign key (updated_by) references core.person (id)', t);
    execute format('alter table %s enable row level security', t);
  end loop;
  foreach t in array array['core.department', 'core.person', 'core.person_team_assist', 'core.person_department',
    'core.role_page_level', 'core.role_capability', 'core.person_page_level', 'core.person_capability',
    'core.setting']
  loop
    execute format('alter table %s add foreign key (deleted_by) references core.person (id)', t);
  end loop;
end $$;

-- ================================================================ the System and Import persons (V44)
-- Named actors that can never sign in: automatic writes are logged as System, imports as Import — never as a real
-- login (replaces D13's QA-account attribution). They are structure, not business records (D17 is not engaged).
insert into core.person (id, full_name_en, full_name_ar, kind, can_sign_in, created_by)
values ('00000000-0000-4000-8000-000000000001', 'System', 'النظام', 'system', false,
        '00000000-0000-4000-8000-000000000001'),
       ('00000000-0000-4000-8000-000000000002', 'Import', 'الاستيراد', 'system', false,
        '00000000-0000-4000-8000-000000000001');

create function core.system_person_id() returns uuid
language sql immutable parallel safe set search_path = ''
as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;

create function core.import_person_id() returns uuid
language sql immutable parallel safe set search_path = ''
as $$ select '00000000-0000-4000-8000-000000000002'::uuid $$;

-- ================================================================ who is asking
-- authz.me(): the active, sign-in-allowed staff person behind auth.uid(), or null (§4: an auth user with no active
-- person behind it can read and write nothing). The rest of authz comes with P3-4.
create function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
$$;
comment on function authz.me() is 'The active staff person behind this sign-in, or null.';
grant usage on schema authz to authenticated;
grant execute on function authz.me() to authenticated;

-- ================================================================ requests
-- audit.begin() opens the request of one person action and remembers it for the transaction (app.request_id); a
-- nested begin (an api function calling another) joins it; audit.end() closes it. A write that arrives with no open
-- request (a migration, psql, a job that forgot) is logged under an automatic 'system' request attributed to the
-- System person — never to whoever happens to be signed in (AUD-03).

create function audit.ensure_request() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if r is null then
    insert into audit.request (actor_id, kind, label_key)
    values (core.system_person_id(), 'system', 'audit.unattended_write')
    returning id into r;
    perform pg_catalog.set_config('app.request_id', r::text, true);
  end if;
  return r;
end
$$;

create function audit.begin(p_kind text default 'ui', p_label_key text default null, p_label_args jsonb default null,
                            p_reason text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  depth int := coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0);
  r uuid;
  actor uuid;
begin
  if depth > 0 then
    perform pg_catalog.set_config('app.request_depth', (depth + 1)::text, true);
    return nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  end if;
  actor := case p_kind
             when 'import' then core.import_person_id()
             when 'job' then core.system_person_id()
             when 'system' then core.system_person_id()
             else authz.me()
           end;
  if actor is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person',
      detail = 'This sign-in has no active person behind it.';
  end if;
  insert into audit.request (actor_id, kind, label_key, label_args, reason)
  values (actor, p_kind, p_label_key, p_label_args, p_reason)
  returning id into r;
  perform pg_catalog.set_config('app.request_id', r::text, true);
  perform pg_catalog.set_config('app.request_depth', '1', true);
  return r;
end
$$;

create function audit.end() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  depth int := coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0);
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if depth > 1 then
    perform pg_catalog.set_config('app.request_depth', (depth - 1)::text, true);
  else
    -- P3-6 adds the fan-out to owners and followers here.
    perform pg_catalog.set_config('app.request_depth', '0', true);
    perform pg_catalog.set_config('app.request_id', '', true);
  end if;
  return r;
end
$$;

-- The actor of the open request (opening an automatic one if needed). Two statements on purpose: the lookup must see
-- the request row that ensure_request() may have just inserted.
create function audit.actor() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r uuid := audit.ensure_request();
  a uuid;
begin
  select q.actor_id into a from audit.request q where q.id = r;
  return a;
end
$$;

-- ================================================================ stamping and capturing
-- audit.stamp() (before insert/update): the database, not the caller, writes who and when and bumps the version (A14);
-- an update that changes nothing a person can see keeps the row's bookkeeping as it was.
-- audit.capture() (after insert/update/delete): one audit.change with only the changed fields; a no-op update is not
-- a change; setting deleted_at is 'remove', clearing it 'restore'; a stray DELETE is still logged.

create function audit.bookkeeping() returns text[]
language sql immutable parallel safe set search_path = ''
as $$ select array['created_at', 'created_by', 'updated_at', 'updated_by', 'version'] $$;

create function audit.stamp() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o jsonb;
  n jsonb := pg_catalog.to_jsonb(new);
begin
  if tg_op = 'INSERT' then
    return pg_catalog.jsonb_populate_record(new, pg_catalog.jsonb_build_object(
      'created_at', pg_catalog.now(), 'created_by', audit.actor(), 'updated_at', null, 'updated_by', null,
      'version', 1));
  end if;
  o := pg_catalog.to_jsonb(old);
  if (n - audit.bookkeeping()) = (o - audit.bookkeeping()) then
    return pg_catalog.jsonb_populate_record(new, o);
  end if;
  return pg_catalog.jsonb_populate_record(new, pg_catalog.jsonb_build_object(
    'created_at', o -> 'created_at', 'created_by', o -> 'created_by', 'updated_at', pg_catalog.now(),
    'updated_by', audit.actor(), 'version', coalesce((o ->> 'version')::int, 0) + 1));
end
$$;

create function audit.capture() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o jsonb;
  n jsonb;
  b jsonb := '{}';
  a jsonb := '{}';
  f text[] := '{}';
  k text;
  act text;
  rid uuid;
begin
  if tg_op = 'INSERT' then
    n := pg_catalog.to_jsonb(new) - audit.bookkeeping();
    for k in select pg_catalog.jsonb_object_keys(n) loop
      if n -> k <> 'null'::jsonb then
        f := f || k;
        a := a || pg_catalog.jsonb_build_object(k, n -> k);
      end if;
    end loop;
    act := 'insert';
    rid := (n ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    o := pg_catalog.to_jsonb(old) - audit.bookkeeping();
    n := pg_catalog.to_jsonb(new) - audit.bookkeeping();
    for k in select pg_catalog.jsonb_object_keys(n) loop
      if (o -> k) is distinct from (n -> k) then
        f := f || k;
        b := b || pg_catalog.jsonb_build_object(k, o -> k);
        a := a || pg_catalog.jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if pg_catalog.cardinality(f) = 0 then
      return null;
    end if;
    act := case
             when o ? 'deleted_at' and o ->> 'deleted_at' is null and n ->> 'deleted_at' is not null then 'remove'
             when o ? 'deleted_at' and o ->> 'deleted_at' is not null and n ->> 'deleted_at' is null then 'restore'
             else 'update'
           end;
    rid := (n ->> 'id')::uuid;
  else
    o := pg_catalog.to_jsonb(old) - audit.bookkeeping();
    for k in select pg_catalog.jsonb_object_keys(o) loop
      if o -> k <> 'null'::jsonb then
        f := f || k;
        b := b || pg_catalog.jsonb_build_object(k, o -> k);
      end if;
    end loop;
    act := 'delete';
    rid := (o ->> 'id')::uuid;
  end if;
  insert into audit.change (request_id, table_name, row_id, action, fields, before, after, version_after)
  values (audit.ensure_request(), tg_table_schema || '.' || tg_table_name, rid, act, f,
          nullif(b, '{}'::jsonb), nullif(a, '{}'::jsonb),
          case when tg_op = 'DELETE' then null else (pg_catalog.to_jsonb(new) ->> 'version')::int end);
  return null;
end
$$;

-- Every business table is watched the same way; later steps call this for their own tables (SCHEMA-01 checks).
create function audit.track(t regclass) returns void
language plpgsql set search_path = ''
as $$
begin
  execute pg_catalog.format('create trigger stamp before insert or update on %s for each row execute function audit.stamp()', t);
  execute pg_catalog.format('create trigger capture after insert or update or delete on %s for each row execute function audit.capture()', t);
end
$$;

select audit.track(t::regclass)
from unnest(array['core.department', 'core.team', 'core.role', 'core.person', 'core.person_team_assist',
  'core.person_department', 'core.page', 'core.capability', 'core.role_page_level', 'core.role_capability',
  'core.person_page_level', 'core.person_capability', 'core.person_auth', 'core.person_profile', 'core.setting_def',
  'core.setting', 'core.wording']) t;

-- ================================================================ row guards
-- A manager chain never loops; a person's team is in their department.
create function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  while cur is not null and hops < 1000 loop
    if cur = new.id then
      raise exception using errcode = 'P0001', message = 'person.manager_cycle';
    end if;
    select p.manager_id into cur from core.person p where p.id = cur;
    hops := hops + 1;
  end loop;
  return new;
end
$$;
create trigger guard before insert or update on core.person for each row execute function core.person_guard();

-- Only a staff person is ever linked to a sign-in: System and Import can never sign in (V44).
create function core.person_auth_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from core.person p where p.id = new.person_id and p.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'person_auth.not_staff';
  end if;
  return new;
end
$$;
create trigger guard before insert or update on core.person_auth for each row execute function core.person_auth_guard();

-- A setting row is never changed in place: a change is a new dated row; only its removal (for Undo) is an update.
create function core.setting_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.key, new.department_id, new.value, new.valid_from, new.reason)
     is distinct from (old.key, old.department_id, old.value, old.valid_from, old.reason) then
    raise exception using errcode = 'P0001', message = 'setting.rows_never_change',
      detail = 'Add a new row with its own date instead.';
  end if;
  return new;
end
$$;
create trigger guard before update on core.setting for each row execute function core.setting_guard();

-- ================================================================ reading settings (§3.2)
-- The department's latest row dated on or before `at`, else the company-wide one, else the definition's default.
create function core.setting_at(p_key text, p_department uuid, p_at date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if not exists (select 1 from core.setting_def d where d.key = p_key) then
    raise exception using errcode = 'P0001', message = 'setting.unknown_key', detail = p_key;
  end if;
  if p_department is not null then
    select s.value into v from core.setting s
    where s.key = p_key and s.department_id = p_department and s.valid_from <= p_at and s.deleted_at is null
    order by s.valid_from desc limit 1;
    if found then
      return v;
    end if;
  end if;
  select s.value into v from core.setting s
  where s.key = p_key and s.department_id is null and s.valid_from <= p_at and s.deleted_at is null
  order by s.valid_from desc limit 1;
  if found then
    return v;
  end if;
  return (select d.default_value from core.setting_def d where d.key = p_key);
end
$$;

-- ================================================================ api.me() (A5)
-- Who am I, before the first paint: the person, their levels on every page, their capabilities, their departments and
-- profile. status: 'ok'; 'not_listed' (this sign-in is linked to no person); 'switched_off' (the person is inactive,
-- removed, not allowed to sign in, or not staff). Levels: an admin role is full everywhere; else the person's
-- override; else the role's default; else none (D2, §5).
create function api.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  p core.person;
  r core.role;
  pr core.person_profile;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select a.person_id into pid from core.person_auth a where a.auth_user_id = uid;
  if pid is null then
    return pg_catalog.jsonb_build_object('status', 'not_listed');
  end if;
  select * into p from core.person where id = pid;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, coalesce(
               case when r.is_admin then 'full'::core.level end,
               (select l.level from core.person_page_level l
                 where l.person_id = p.id and l.page_key = pg.key and l.deleted_at is null),
               (select l.level from core.role_page_level l
                 where l.role_id = r.id and l.page_key = pg.key and l.deleted_at is null),
               'none'::core.level))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c
      where c.active and coalesce(
              case when r.is_admin then true end,
              (select x.granted from core.person_capability x
                where x.person_id = p.id and x.capability_key = c.key and x.deleted_at is null),
              (select x.granted from core.role_capability x
                where x.role_id = r.id and x.capability_key = c.key and x.deleted_at is null),
              false)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(d order by d)
      from (select p.department_id as d
            union
            select pd.department_id from core.person_department pd
            where pd.person_id = p.id and pd.deleted_at is null) ds),
    'profile', case when pr.id is null then null else pg_catalog.jsonb_build_object(
      'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar,
      'avatar_file_id', pr.avatar_file_id, 'avatar_color', pr.avatar_color,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value,
      'theme', pr.theme, 'density', pr.density, 'locale', pr.locale, 'start_page', pr.start_page,
      'drawer_pinned', pr.drawer_pinned, 'notify', pr.notify, 'version', pr.version) end
  );
end
$$;
comment on function api.me() is 'Who am I (A5): status, person, levels by page, capabilities, departments, profile.';
grant execute on function api.me() to authenticated;
