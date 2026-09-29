-- v2 notifications, follows, last seen, saved and default views, bulk commands and the alerts job (P3-6, part 2):
-- TECH-SPEC §3.3, §6 (shared patterns); V45, V61, V78; V129, V130. Every function the Data API reaches is a
-- security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ notifications (§3.3)
create table notify.notification (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  kind text not null check (kind in ('assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change',
                                     'decision_needed', 'report_issued', 'report_for_review', 'appraisal_step',
                                     'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
                                     'alert_invoice_unpaid', 'alert_kpi_checkin')),
  entity_table text,
  entity_id uuid,
  request_id uuid references audit.request (id),
  actor_id uuid references core.person (id),
  label_key text,
  label_args jsonb,
  alert_key text,
  alert_day date,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  snoozed_until timestamptz,
  check ((alert_key is null) = (alert_day is null)),
  check (entity_id is null or entity_table is not null)
);
create index notification_inbox on notify.notification (person_id, read_at nulls first, created_at desc);
create unique index notification_alert_once on notify.notification (person_id, alert_key, alert_day)
  where alert_key is not null;
alter table notify.notification enable row level security;
comment on table notify.notification is 'One notification to one person (§3.3): pushed by the command that caused it, fanned out by audit.end(), or made by the daily alerts job. In the app only (V45).';

-- Follow / Watch on any record (V61): followers are told of every change by someone else. Owners need no row here.
create table notify.follow (
  person_id uuid not null references core.person (id),
  entity_table text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (person_id, entity_table, entity_id)
);
create index follow_record on notify.follow (entity_table, entity_id);
alter table notify.follow enable row level security;
comment on table notify.follow is 'Who follows which record (V61).';

-- "Since your last visit" (§6): when each person last opened each page.
create table core.person_last_seen (
  person_id uuid not null references core.person (id),
  page_key text not null references core.page (key),
  seen_at timestamptz not null,
  primary key (person_id, page_key)
);
alter table core.person_last_seen enable row level security;
comment on table core.person_last_seen is 'When a person last opened a page — "Since your last visit" on My day and in lists (§6).';

-- ================================================================ saved views (V61, V78)
create table core.saved_view (
  id uuid primary key default gen_random_uuid(),
  page_key text not null references core.page (key),
  owner_id uuid not null references core.person (id),
  name text not null check (pg_catalog.btrim(name) <> '' and pg_catalog.length(name) <= 80),
  query jsonb not null default '{}' check (pg_catalog.jsonb_typeof(query) = 'object'),
  shared boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id),
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index saved_view_one_name on core.saved_view (page_key, owner_id, pg_catalog.lower(name))
  where deleted_at is null;
alter table core.saved_view enable row level security;
comment on table core.saved_view is 'A list''s filters, columns, sort and grouping under a name: personal, or shared with everyone who can open the page (V61, V78).';
select audit.track('core.saved_view');

create table core.person_default_view (
  person_id uuid not null references core.person (id),
  page_key text not null references core.page (key),
  saved_view_id uuid not null references core.saved_view (id),
  primary key (person_id, page_key)
);
alter table core.person_default_view enable row level security;
comment on table core.person_default_view is 'The view a page opens on for that person (V78).';

select core.index_foreign_keys('notify');
select core.index_foreign_keys('core');

-- ================================================================ who is told (V129)
-- A person is told of a kind of thing when they may sign in, the kind is on for their department (notify.kinds_enabled,
-- department first — §3.2) and they have not turned it off in My profile (person_profile.notify, per kind:
-- {"<kind>": {"in_app": false}}, or {"<kind>": false} for every channel).
create function notify.may_notify(p_person uuid, p_kind text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select coalesce(core.setting_at('notify.kinds_enabled', p.department_id, core.riyadh_today()) ? p_kind, true)
           and not coalesce((select (pr.notify -> p_kind) = 'false'::jsonb
                                    or (pr.notify -> p_kind -> 'in_app') = 'false'::jsonb
                             from core.person_profile pr where pr.person_id = p.id), false)
    from core.person p
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null), false)
$$;

-- Pushed by the command that caused it (assigned, helper added, mentioned, report issued …): never to the actor of the
-- open request, linked to it. Returns whether a notification was made. Later steps call it.
create function notify.push(p_person uuid, p_kind text, p_entity_table text, p_entity_id uuid,
                            p_label_key text default null, p_label_args jsonb default null) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  actor uuid := (select q.actor_id from audit.request q where q.id = r);
begin
  if p_person is null or p_person = actor or not notify.may_notify(p_person, p_kind) then
    return false;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  values (p_person, p_kind, p_entity_table, p_entity_id, r, actor, p_label_key, p_label_args);
  return true;
end
$$;

-- "Changed by someone else" (§3.3): when a person's request closes, the owners of every record it changed, and everyone
-- who follows one, are told — one notification per person per request (an owner's before a follower's, the first record
-- changed), never the actor. Imports, jobs and the system tell nobody this way (the import says so itself).
create function notify.fan_out(p_request uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  q audit.request;
  n int;
begin
  select * into q from audit.request where id = p_request;
  if q.id is null or q.kind not in ('ui', 'undo') then
    return 0;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  select distinct on (x.person_id) x.person_id, x.kind, x.table_name, x.row_id, q.id, q.actor_id, q.label_key,
         q.label_args
  from (
    select o.person_id, 'changed_by_other' as kind, c.table_name, c.row_id, c.id, 0 as pri
    from audit.change c cross join lateral pg_catalog.unnest(core.owners_of(c.table_name, c.row_id)) o(person_id)
    where c.request_id = q.id
    union all
    select f.person_id, 'followed_change', c.table_name, c.row_id, c.id, 1
    from audit.change c join notify.follow f on f.entity_table = c.table_name and f.entity_id = c.row_id
    where c.request_id = q.id
  ) x
  where x.person_id <> q.actor_id and notify.may_notify(x.person_id, x.kind)
  order by x.person_id, x.pri, x.id;
  get diagnostics n = row_count;
  return n;
end
$$;

-- audit.end() as P3-1b wrote it, now telling owners and followers when the outermost request closes.
create or replace function audit.end() returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  depth int := coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0);
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if depth > 1 then
    perform pg_catalog.set_config('app.request_depth', (depth - 1)::text, true);
  else
    perform pg_catalog.set_config('app.request_depth', '0', true);
    perform pg_catalog.set_config('app.request_id', '', true);
    if r is not null then
      perform notify.fan_out(r);
    end if;
  end if;
  return r;
end
$$;

-- ================================================================ the alerts job (§3.3, V61)
-- An alert kind is a function notify.alert_<kind>() returning setof notify.alert, added by the step that owns it
-- (contract expiring — P3-8; KPI behind and check-in — P5; invoice unpaid — P4). Once a day the job asks each and makes
-- one notification per person per alert key per Riyadh day, so a second run the same day makes nothing new. A kind
-- that fails is reported and the others still run.
create type notify.alert as (person_id uuid, alert_key text, entity_table text, entity_id uuid, label_key text,
                             label_args jsonb);

create function notify.generate_alerts() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  f record;
  k int;
  n int := 0;
  day date := core.riyadh_today();
begin
  for f in
    select p.proname
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'notify' and p.proname like 'alert\_%' and p.proretset
      and p.prorettype = 'notify.alert'::regtype and p.pronargs = 0
    order by p.proname
  loop
    begin
      execute pg_catalog.format(
        'insert into notify.notification (person_id, kind, entity_table, entity_id, label_key, label_args, alert_key,'
        || ' alert_day) select a.person_id, %L, a.entity_table, a.entity_id, a.label_key, a.label_args, a.alert_key, $1'
        || ' from notify.%I() a where a.alert_key is not null and notify.may_notify(a.person_id, %L)'
        || ' on conflict (person_id, alert_key, alert_day) where alert_key is not null do nothing',
        f.proname, f.proname, f.proname) using day;
      get diagnostics k = row_count;
      n := n + k;
    exception when others then
      raise warning 'notify.generate_alerts: % failed: %', f.proname, sqlerrm;
    end;
  end loop;
  return n;
end
$$;
comment on function notify.generate_alerts() is 'The daily alerts job (06:00 Riyadh): every notify.alert_<kind>(), once per person, key and day.';

-- Scheduled where pg_cron exists (the Supabase project and stack; not plain Postgres): 06:00 Riyadh = 03:00 UTC.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('notify-generate-alerts', '0 3 * * *', 'select notify.generate_alerts()');
  end if;
end $$;

-- ================================================================ reading and handling one's own notifications
create function notify.list(p_tab text default 'all', p_before timestamptz default null, p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_tab not in ('all', 'mentions', 'assigned') then
    raise exception using errcode = 'P0001', message = 'notify.unknown_tab', detail = p_tab;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', x.id, 'kind', x.kind, 'entity', x.entity, 'entity_id', x.entity_id, 'request_id', x.request_id,
             'actor_id', x.actor_id, 'actor_name_en', x.actor_name_en, 'actor_name_ar', x.actor_name_ar,
             'label_key', x.label_key, 'label_args', x.label_args, 'created_at', x.created_at, 'read_at', x.read_at)
             order by x.created_at desc, x.id)
    from (
      select n.*, coalesce(e.key, n.entity_table) as entity,
             coalesce(pr.display_name_en, a.nickname_en, a.full_name_en) as actor_name_en,
             coalesce(pr.display_name_ar, a.nickname_ar, a.full_name_ar) as actor_name_ar
      from notify.notification n
      left join core.entity e on e.table_name = n.entity_table
      left join core.person a on a.id = n.actor_id
      left join core.person_profile pr on pr.person_id = n.actor_id
      where n.person_id = me
        and (n.snoozed_until is null or n.snoozed_until <= core.clock())
        and (p_before is null or n.created_at < p_before)
        and (p_tab = 'all' or (p_tab = 'mentions' and n.kind = 'mentioned')
             or (p_tab = 'assigned' and n.kind in ('assigned', 'helper_added')))
      order by n.created_at desc, n.id
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x), '[]'::jsonb);
end
$$;

create function notify.unread_count() returns int
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return (select pg_catalog.count(*)::int from notify.notification n
          where n.person_id = me and n.read_at is null
            and (n.snoozed_until is null or n.snoozed_until <= core.clock()));
end
$$;

-- Mark read: the given ones, or every unread one showing (Mark all read — a snoozed one comes back unread). Only
-- one's own; returns how many changed.
create function notify.mark_read(p_ids uuid[] default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  update notify.notification set read_at = core.clock()
  where person_id = me and read_at is null
    and (id = any (p_ids) or (p_ids is null and (snoozed_until is null or snoozed_until <= core.clock())));
  get diagnostics n = row_count;
  return n;
end
$$;

-- Snooze until a time (a date, or "tomorrow 08:00"): hidden from the list and the count until then — at most 30 days.
create function notify.snooze(p_ids uuid[], p_until timestamptz) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_until is null or p_until <= core.clock() then
    raise exception using errcode = 'P0001', message = 'notify.snooze_in_the_past';
  end if;
  if p_until > core.clock() + interval '30 days' then
    raise exception using errcode = 'P0001', message = 'notify.snooze_too_far';
  end if;
  update notify.notification set snoozed_until = p_until where person_id = me and id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end
$$;

-- ================================================================ following a record (V61)
-- Whether the signed-in person may see a record: an admin; View (or more) on its record type's page — but a profile
-- only its owner; or its owner.
create function core.can_see_record(p_entity text, p_id uuid) returns core.entity
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  found boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into e from core.entity where key = p_entity and active;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
  end if;
  execute pg_catalog.format('select exists (select 1 from %s t where t.id = $1)', pg_catalog.to_regclass(e.table_name))
    into found using p_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (authz.is_admin()
          or (e.page_key is not null and e.page_key <> 'settings.profile' and authz.level_of(me, e.page_key) >= 'view')
          or me = any (core.owners_of(e.table_name, p_id))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'view')::text;
  end if;
  return e;
end
$$;

create function notify.follow_set(p_entity text, p_id uuid, p_on boolean) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  if p_on then
    insert into notify.follow (person_id, entity_table, entity_id) values (me, e.table_name, p_id)
    on conflict do nothing;
  else
    delete from notify.follow where person_id = me and entity_table = e.table_name and entity_id = p_id;
  end if;
  return p_on;
end
$$;

create function notify.following(p_entity text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  return exists (select 1 from notify.follow f
                 where f.person_id = me and f.entity_table = e.table_name and f.entity_id = p_id);
end
$$;

-- ================================================================ since your last visit (§6)
-- Marks the page seen now and answers when it was seen before (null the first time): the page counts what is newer.
create function core.page_seen(p_page text) returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  before timestamptz;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if authz.level_of(me, p_page) = 'none' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', 'view')::text;
  end if;
  select s.seen_at into before from core.person_last_seen s where s.person_id = me and s.page_key = p_page;
  insert into core.person_last_seen (person_id, page_key, seen_at) values (me, p_page, core.clock())
  on conflict (person_id, page_key) do update set seen_at = excluded.seen_at;
  return before;
end
$$;

-- ================================================================ saved views (V61, V78, V130)
-- A page's views for the signed-in person: their own and the shared ones, with the one it opens on.
create function core.views(p_page text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require(p_page, 'view');
  dflt uuid := (select d.saved_view_id from core.person_default_view d where d.person_id = me and d.page_key = p_page);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', v.id, 'name', v.name, 'query', v.query, 'shared', v.shared, 'sort', v.sort, 'owner_id', v.owner_id,
             'mine', v.owner_id = me, 'default', v.id = dflt, 'version', v.version)
             order by v.sort, pg_catalog.lower(v.name), v.id)
    from core.saved_view v
    where v.page_key = p_page and v.deleted_at is null and (v.owner_id = me or v.shared)), '[]'::jsonb);
end
$$;

-- Save a view: new (p_id null) for anyone who can open the page; shared only with Full on it. An existing view only by
-- its owner, with the version it read (A14). Returns {id, version, request_id}.
create function core.view_save(p_id uuid, p_page text, p_name text, p_query jsonb, p_shared boolean default false,
                               p_sort int default 0, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require(p_page, 'view');
  v core.saved_view;
  req uuid;
begin
  if p_id is not null then
    select * into v from core.saved_view where id = p_id and deleted_at is null;
    if v.id is null or v.page_key <> p_page then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v.owner_id <> me then
      raise exception using errcode = '42501', message = 'view.not_yours';
    end if;
  end if;
  if coalesce(p_shared, false) and authz.level_of(me, p_page) < 'full' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', 'full')::text;
  end if;
  if p_id is null then
    req := audit.begin('ui', 'view.saved', pg_catalog.jsonb_build_object('page', p_page, 'name', p_name), null);
    insert into core.saved_view (page_key, owner_id, name, query, shared, sort)
    values (p_page, me, pg_catalog.btrim(p_name), coalesce(p_query, '{}'), coalesce(p_shared, false),
            coalesce(p_sort, 0))
    returning * into v;
  else
    perform core.check_version('core.saved_view', p_id, p_version,
      array_remove(array[
        case when v.name is distinct from pg_catalog.btrim(p_name) then 'name' end,
        case when v.query is distinct from coalesce(p_query, '{}') then 'query' end,
        case when v.shared is distinct from coalesce(p_shared, false) then 'shared' end,
        case when v.sort is distinct from coalesce(p_sort, 0) then 'sort' end], null));
    req := audit.begin('ui', 'view.saved', pg_catalog.jsonb_build_object('page', p_page, 'name', p_name), null);
    update core.saved_view set name = pg_catalog.btrim(p_name), query = coalesce(p_query, '{}'),
                               shared = coalesce(p_shared, false), sort = coalesce(p_sort, 0)
    where id = p_id returning * into v;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', v.id, 'version', v.version, 'request_id', req);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'view.name_taken', detail = pg_catalog.btrim(p_name);
end
$$;

-- Remove views — several at once is one request and one Undo (a bulk command, V61). Only one's own (an admin any).
create function core.views_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  req uuid;
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if exists (select 1 from pg_catalog.unnest(p_ids) i(id)
             where not exists (select 1 from core.saved_view v where v.id = i.id and v.deleted_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.is_admin() and exists (select 1 from core.saved_view v where v.id = any (p_ids) and v.owner_id <> me) then
    raise exception using errcode = '42501', message = 'view.not_yours';
  end if;
  req := audit.begin('ui', 'view.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  update core.saved_view set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason
  where id = any (p_ids);
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;

-- The view a page opens on for the signed-in person (V78): one they can see on that page, or none (null).
create function core.view_default_set(p_page text, p_view uuid) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require(p_page, 'view');
begin
  if p_view is null then
    delete from core.person_default_view where person_id = me and page_key = p_page;
    return null;
  end if;
  if not exists (select 1 from core.saved_view v where v.id = p_view and v.page_key = p_page and v.deleted_at is null
                 and (v.owner_id = me or v.shared)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  insert into core.person_default_view (person_id, page_key, saved_view_id) values (me, p_page, p_view)
  on conflict (person_id, page_key) do update set saved_view_id = excluded.saved_view_id;
  return p_view;
end
$$;

grant usage on schema notify to authenticated;
grant execute on function notify.list(text, timestamptz, int), notify.unread_count(), notify.mark_read(uuid[]),
  notify.snooze(uuid[], timestamptz), notify.follow_set(text, uuid, boolean), notify.following(text, uuid),
  core.page_seen(text), core.views(text), core.view_save(uuid, text, text, jsonb, boolean, int, int),
  core.views_remove(uuid[], text), core.view_default_set(text, uuid) to authenticated;

-- ================================================================ the door (V124)
create function api.notifications(p_tab text default 'all', p_before timestamptz default null, p_limit int default 50)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select notify.list(p_tab, p_before, p_limit) $$;
comment on function api.notifications(text, timestamptz, int) is 'The bell: my notifications, newest first — all, mentions or assigned to me; snoozed ones hidden until their time.';

create function api.notifications_unread() returns int
language sql stable security invoker set search_path = ''
as $$ select notify.unread_count() $$;

create function api.notifications_mark_read(p_ids uuid[] default null) returns int
language sql volatile security invoker set search_path = ''
as $$ select notify.mark_read(p_ids) $$;

create function api.notifications_snooze(p_ids uuid[], p_until timestamptz) returns int
language sql volatile security invoker set search_path = ''
as $$ select notify.snooze(p_ids, p_until) $$;

create function api.follow(p_entity text, p_id uuid, p_on boolean default true) returns boolean
language sql volatile security invoker set search_path = ''
as $$ select notify.follow_set(p_entity, p_id, p_on) $$;

create function api.following(p_entity text, p_id uuid) returns boolean
language sql stable security invoker set search_path = ''
as $$ select notify.following(p_entity, p_id) $$;

create function api.page_seen(p_page text) returns timestamptz
language sql volatile security invoker set search_path = ''
as $$ select core.page_seen(p_page) $$;

create function api.views(p_page text) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.views(p_page) $$;

create function api.view_save(p_id uuid, p_page text, p_name text, p_query jsonb, p_shared boolean default false,
                              p_sort int default 0, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.view_save(p_id, p_page, p_name, p_query, p_shared, p_sort, p_version) $$;

create function api.views_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.views_remove(p_ids, p_reason) $$;

create function api.view_default_set(p_page text, p_view uuid) returns uuid
language sql volatile security invoker set search_path = ''
as $$ select core.view_default_set(p_page, p_view) $$;

grant execute on function api.notifications(text, timestamptz, int), api.notifications_unread(),
  api.notifications_mark_read(uuid[]), api.notifications_snooze(uuid[], timestamptz),
  api.follow(text, uuid, boolean), api.following(text, uuid), api.page_seen(text), api.views(text),
  api.view_save(uuid, text, text, jsonb, boolean, int, int), api.views_remove(uuid[], text),
  api.view_default_set(text, uuid) to authenticated;
