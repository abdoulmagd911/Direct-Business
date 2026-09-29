-- v2 round 7 — the oversight's QA review of P3-6d (29 Sep): rights are read when an undo or a restore happens, not
-- when the work was done (a demoted admin keeps none of an admin's rights); undo and the alerts job ask whether the
-- person may see the record (V143); the appraisal line is asked about any two people; an undo or a restore of a
-- sign-in record goes through the admin route, which keeps Auth in step; a list value in Recently deleted is in use;
-- retiring a list value leaves history and definitions alone and names a clash; every department, team and role has
-- its Arabic name; Recently deleted names things in Arabic; the setting defaults are written by one function. V161–V165.
-- Forward-only (V103).

-- ================================================================ one list of access tables (V128)
-- The tables whose rows are access: only an admin undoes or restores them. touches_access and restore read this list.
create function audit.access_tables() returns text[]
language sql immutable parallel safe set search_path = ''
as $$
  select array['core.person_page_level', 'core.person_capability', 'core.role_page_level', 'core.role_capability',
               'core.person_email', 'core.person_auth']
$$;

create or replace function audit.touches_access(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from audit.change c
    where c.request_id = p_request
      and (c.table_name = any (audit.access_tables())
           or (c.table_name = 'core.person' and c.fields && array['role_id', 'kind', 'active', 'can_sign_in'])))
$$;

-- The sign-in records a request changed: an allowed e-mail, a sign-in link, a person switched on or off — Auth must be
-- kept in step when they are undone.
create function audit.touches_sign_in(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from audit.change c
    where c.request_id = p_request
      and (c.table_name in ('core.person_email', 'core.person_auth')
           or (c.table_name = 'core.person' and c.fields && array['active', 'can_sign_in', 'kind'])))
$$;

-- ================================================================ rights now, not then (QA, V161)
-- May `me` undo this request? Asked at the moment of the undo, from the person's rights today:
--  · an admin: always;
--  · access (V128): admins only;
--  · every record it touched must be one the person may see now (V143);
--  · Full on every record it touched: yes, at any time;
--  · else within the window (audit.undo_window_hours): the person must still hold at least Own on every record it
--    touched (a record type with neither page nor level of its own counts as Own), and — for someone else's request —
--    be one of each record's owners.
-- Having made the change is never a right by itself: an admin demoted to head keeps no admin's undo.
create or replace function audit.undo_allowed(q audit.request, me uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  window_h int := coalesce((core.setting_at('audit.undo_window_hours', null, core.riyadh_today()) #>> '{}')::int, 24);
begin
  if authz.is_admin() then
    return true;
  end if;
  if audit.touches_access(q.id) then
    return false;
  end if;
  -- My profile (V9, V97): a change you made to your own names or your own profile is yours to undo within the window,
  -- whatever your level on the people pages — exactly what api.profile_update let you change.
  if q.actor_id = me and q.at > core.clock() - pg_catalog.make_interval(hours => window_h)
     and not exists (
       select 1 from audit.change c
       where c.request_id = q.id
         and not ((c.table_name = 'core.person' and c.row_id = me
                   and c.fields <@ array['full_name_en', 'full_name_ar', 'nickname_en', 'nickname_ar'])
                  or (c.table_name = 'core.person_profile'
                      and exists (select 1 from core.person_profile pp where pp.id = c.row_id and pp.person_id = me)))) then
    return true;
  end if;
  if exists (select 1 from audit.change c where c.request_id = q.id and not authz.can_see_as(me, c.table_name, c.row_id)) then
    return false;
  end if;
  if not exists (select 1 from audit.change c
                 left join core.entity e on e.table_name = c.table_name and e.active
                 where c.request_id = q.id
                   and (e.id is null or authz.record_level(me, c.table_name, c.row_id) < 'full')) then
    return true;
  end if;
  if q.at <= core.clock() - pg_catalog.make_interval(hours => window_h) then
    return false;
  end if;
  return not exists (
    select 1 from audit.change c
    left join core.entity e on e.table_name = c.table_name and e.active
    where c.request_id = q.id
      and (e.id is null
           or not ((e.page_key is null and e.level is null) or authz.record_level(me, c.table_name, c.row_id) >= 'own')
           or (q.actor_id is distinct from me and not (me = any (core.owners_of(c.table_name, c.row_id))))));
end
$$;

-- ================================================================ sign-in changes go through the admin route (QA)
-- Undoing or restoring an allowed e-mail, a sign-in link or a switch changes who may sign in, so Supabase Auth must
-- follow in the same breath — which only the server can do, with the secret key (/auth/admin/undo, /auth/admin/restore).
-- The route takes a one-time ticket first (service role only), for the signed-in person and that one request or record,
-- and hands its id to the database with the call (api.undo_ticketed, api.restore_ticketed): the database undoes or
-- restores a sign-in record only against that ticket — fresh, unused, issued for this person and this target — so no
-- screen can skip the re-sync, and a ticket left over by a call that failed serves nobody else (QA-94).
create table core.auth_ticket (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('undo', 'restore')),
  target text not null check (pg_catalog.length(target) <= 200),
  person_id uuid not null references core.person (id),
  issued_at timestamptz not null default now(),
  used_at timestamptz
);
create index auth_ticket_person on core.auth_ticket (person_id);
alter table core.auth_ticket enable row level security;
comment on table core.auth_ticket is 'One-time tickets the admin route takes (service role) before undoing or restoring a sign-in record, so Auth is re-synced every time (V162).';

create function core.auth_ticket_issue(p_kind text, p_target text, p_person uuid) returns uuid
language sql volatile security definer set search_path = ''
as $$ insert into core.auth_ticket (kind, target, person_id) values (p_kind, p_target, p_person) returning id $$;

-- Takes the ticket named — issued for the signed-in person and this undo or restore, under a minute old, unused — or
-- answers false.
create function core.auth_ticket_take(p_ticket uuid, p_kind text, p_target text) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t uuid;
begin
  if p_ticket is null then
    return false;
  end if;
  select a.id into t from core.auth_ticket a
  where a.id = p_ticket and a.kind = p_kind and a.target = p_target and a.person_id = authz.me()
    and a.used_at is null and a.issued_at > pg_catalog.now() - interval '1 minute'
  for update;
  if t is null then
    return false;
  end if;
  update core.auth_ticket set used_at = pg_catalog.now() where id = t;
  return true;
end
$$;

create function api.auth_ticket_issue(p_kind text, p_target text, p_person uuid) returns uuid
language sql volatile security invoker set search_path = ''
as $$ select core.auth_ticket_issue(p_kind, p_target, p_person) $$;
revoke all on function core.auth_ticket_issue(text, text, uuid), api.auth_ticket_issue(text, text, uuid),
  core.auth_ticket_take(uuid, text, text) from public;
grant execute on function core.auth_ticket_issue(text, text, uuid), api.auth_ticket_issue(text, text, uuid)
  to service_role;

-- audit.undo as P3-6d wrote it: a sign-in change is undone only against the admin route's ticket, named in the call.
create function audit.undo_ticketed(p_request uuid, p_ticket uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q audit.request;
  c audit.change;
  req uuid;
  holder text;
  resync uuid[];
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into q from audit.request where id = p_request for update;
  if q.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if q.kind in ('system', 'job') then
    raise exception using errcode = 'P0001', message = 'undo.not_undoable', detail = q.kind;
  end if;
  if q.undone_by is not null then
    raise exception using errcode = 'P0001', message = 'undo.already_undone';
  end if;
  if not exists (select 1 from audit.change x where x.request_id = q.id) then
    raise exception using errcode = 'P0001', message = 'undo.nothing_to_undo';
  end if;
  if not audit.undo_allowed(q, me) then
    raise exception using errcode = '42501', message = 'undo.not_allowed';
  end if;
  if audit.touches_sign_in(q.id) and not core.auth_ticket_take(p_ticket, 'undo', q.id::text) then
    raise exception using errcode = 'P0001', message = 'undo.via_admin_route', detail = '/auth/admin/undo';
  end if;
  req := audit.begin('undo', 'undo.done', pg_catalog.jsonb_build_object('request', q.id, 'label', q.label_key), null);
  begin
    for c in select * from audit.change x where x.request_id = q.id order by x.id desc loop
      perform audit.revert_change(c, q.id, req, me);
    end loop;
  exception when unique_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'undo.blocked_by_duplicate', detail = holder;
  end;
  perform audit.undo_mark(q, req);
  -- an update logs only the fields it changed, so the person comes from the row itself
  select pg_catalog.array_agg(distinct x.pid) into resync
  from (select coalesce((c2.after ->> 'person_id')::uuid, (c2.before ->> 'person_id')::uuid,
                        (select e.person_id from core.person_email e where e.id = c2.row_id),
                        (select a.person_id from core.person_auth a where a.id = c2.row_id)) as pid
        from audit.change c2 where c2.request_id = q.id and c2.table_name in ('core.person_email', 'core.person_auth')
        union
        select c2.row_id from audit.change c2
        where c2.request_id = q.id and c2.table_name = 'core.person' and c2.fields && array['active', 'can_sign_in', 'kind']) x
  where x.pid is not null;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req, 'undone', q.id,
                                       'auth_resync', coalesce(pg_catalog.to_jsonb(resync), '[]'::jsonb));
end
$$;

-- Undo from anywhere but the admin route: no ticket, so a sign-in change is refused (undo.via_admin_route).
create or replace function audit.undo(p_request uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select audit.undo_ticketed(p_request, null) $$;
create function api.undo_ticketed(p_request uuid, p_ticket uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select audit.undo_ticketed(p_request, p_ticket) $$;
revoke all on function audit.undo_ticketed(uuid, uuid), api.undo_ticketed(uuid, uuid) from public;
grant execute on function audit.undo_ticketed(uuid, uuid), api.undo_ticketed(uuid, uuid) to authenticated;

-- What a record type's own write asks, asked again to bring it back (QA-47): an identifier needs its side's identify
-- capability (a client ID or a discount code the Client side's), a side's owner its side's assign, a credit limit
-- finance.credit_control — raised as the write itself would raise it. Admins hold them all.
create function core.restore_needs(p_table text, p_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  i record;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_table = 'partner.identifier' then
    select x.partner_id, x.kind into i from partner.identifier x where x.id = p_id;
    perform partner.require_cap(i.partner_id,
                                case when i.kind in ('payments_client_id', 'discount_code') then 'client' end, 'identify');
  elsif p_table = 'partner.side_owner' then
    select x.side into i from partner.side_owner x where x.id = p_id;
    perform authz.require_capability(partner.side_page(i.side) || '.assign');
  elsif p_table = 'partner.credit_limit' then
    perform authz.require_capability('finance.credit_control');
  end if;
end
$$;
revoke all on function core.restore_needs(text, uuid) from public;

-- core.restore as P3-8b-1 wrote it, with rights read now: whoever removed it restores it only while they still hold
-- Own on it (or it has neither page nor level), and the record type's own capability (core.restore_needs); access rows
-- stay an admin's (audit.access_tables); a sign-in record is restored only against the admin route's ticket, named in the
-- call, and the answer names whose sign-in to re-sync.
create function core.restore_ticketed(p_entity text, p_id uuid, p_ticket uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  gone timestamptz;
  who uuid;
  req uuid;
  holder text;
  may_own boolean;
  resync uuid[];
begin
  if not exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(e.table_name)
                   and a.attname = 'deleted_at' and not a.attisdropped) then
    raise exception using errcode = 'P0001', message = 'restore.not_removable', detail = p_entity;
  end if;
  execute pg_catalog.format('select t.deleted_at, t.deleted_by from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
    into gone, who using p_id;
  if gone is null then
    raise exception using errcode = 'P0001', message = 'restore.not_removed';
  end if;
  if gone < core.clock() - pg_catalog.make_interval(days => days) then
    raise exception using errcode = 'P0001', message = 'restore.too_late', detail = days::text;
  end if;
  may_own := (e.page_key is null and e.level is null) or authz.record_level(me, e.table_name, p_id) >= 'own';
  if not (authz.is_admin()
          or (not (e.table_name = any (audit.access_tables()))
              and (authz.record_level(me, e.table_name, p_id) = 'full'
                   or (may_own and (who = me or me = any (core.owners_of(e.table_name, p_id))))))) then
    raise exception using errcode = '42501', message = 'restore.not_allowed';
  end if;
  perform core.restore_needs(e.table_name, p_id);
  if e.table_name in ('core.person_email', 'core.person_auth')
     and not core.auth_ticket_take(p_ticket, 'restore', p_entity || ':' || p_id) then
    raise exception using errcode = 'P0001', message = 'restore.via_admin_route', detail = '/auth/admin/restore';
  end if;
  req := audit.begin('ui', 'record.restored', pg_catalog.jsonb_build_object('entity', p_entity), p_reason);
  begin
    perform audit.write_fields(e.table_name, p_id, '{"deleted_at": null, "deleted_by": null, "delete_reason": null}');
  exception when unique_violation or exclusion_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'restore.blocked_by_duplicate', detail = holder;
  end;
  if e.table_name in ('core.person_email', 'core.person_auth') then
    execute pg_catalog.format('select array[t.person_id] from %s t where t.id = $1', pg_catalog.to_regclass(e.table_name))
      into resync using p_id;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'auth_resync', coalesce(pg_catalog.to_jsonb(resync), '[]'::jsonb));
end
$$;

-- Restore from anywhere but the admin route: no ticket, so a sign-in record is refused (restore.via_admin_route).
create or replace function core.restore(p_entity text, p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.restore_ticketed(p_entity, p_id, null, p_reason) $$;
create function api.restore_ticketed(p_entity text, p_id uuid, p_ticket uuid, p_reason text default null)
  returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.restore_ticketed(p_entity, p_id, p_ticket, p_reason) $$;
revoke all on function core.restore_ticketed(text, uuid, uuid, text), api.restore_ticketed(text, uuid, uuid, text)
  from public;
grant execute on function core.restore_ticketed(text, uuid, uuid, text), api.restore_ticketed(text, uuid, uuid, text)
  to authenticated;

-- ================================================================ the alerts job asks too (V143)
-- notify.generate_alerts as P3-6b wrote it: nobody is told of a record they may not see.
create or replace function notify.generate_alerts() returns int
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
        || ' and (a.entity_table is null or authz.can_see_as(a.person_id, a.entity_table, a.entity_id))'
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

-- ================================================================ the appraisal line, about anyone (V96, QA)
-- Whether `p_person`'s direct manager is `p_manager` — never further up the chain. Rules that decide for someone other
-- than the signed-in person (who may see an appraisal, who is told) ask with that person.
create function authz.reports_to(p_person uuid, p_manager uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.manager_id = p_manager from core.person p where p.id = p_person), false)
$$;
create or replace function authz.reports_to(p_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select authz.reports_to(p_person, authz.me()) $$;
-- The two-person form stays inside the database (QA-99): only rules that run as their owner ask it.
revoke all on function authz.reports_to(uuid, uuid) from public, authenticated;

-- ================================================================ setting lists (V97; QA)
-- A list entry is in use by live records and by records waiting in Recently deleted (a restore would bring back a
-- reference to it), counted apart.
create or replace function core.list_uses(p_table text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r record;
  n bigint;
  gone bigint;
  total bigint := 0;
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  uses jsonb := '[]';
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col,
           exists (select 1 from pg_catalog.pg_attribute d where d.attrelid = c.conrelid and d.attname = 'deleted_at'
                   and not d.attisdropped) as soft
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = pg_catalog.to_regclass(p_table) and pg_catalog.cardinality(c.conkey) = 1
    order by 1, 2
  loop
    execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1%s', r.tbl, r.col,
                              case when r.soft then ' and t.deleted_at is null' else '' end)
      into n using p_id;
    gone := 0;
    if r.soft then
      execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1 and t.deleted_at is not null'
                                || ' and t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)', r.tbl, r.col)
        into gone using p_id, days;
    end if;
    if n + gone > 0 then
      total := total + n + gone;
      uses := uses || pg_catalog.jsonb_build_object('table', r.tbl, 'column', r.col, 'count', n, 'in_recently_deleted', gone);
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('total', total, 'uses', uses);
end
$$;

alter table core.entity add column history boolean not null default false;
comment on column core.entity.history is 'A record of what happened, never rewritten: retiring a list entry leaves it on these rows, counted apart (V161).';

-- Whether a table is history, never rewritten (the registry says so — V161).
create function core.is_history(p_table text) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select e.history from core.entity e where e.table_name = p_table and e.active), false) $$;

-- Retire an entry by replacing it (V97): every live record that uses it is moved to the replacement and the entry is
-- archived — one request, with the counts, and one Undo. Rows that are history (the registry says which — a side's
-- status changes) and the rows of other setting lists (definitions: an activity type's outcomes) keep the old entry,
-- counted apart. A move that would make two live rows one names the rule it breaks.
create or replace function core.list_retire(p_list text, p_id uuid, p_replacement uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  why text := core.access_reason(p_reason);
  rep jsonb;
  r record;
  n bigint;
  moved bigint := 0;
  moved_removed bigint := 0;
  kept bigint := 0;
  defs bigint := 0;
  gone bigint;
  req uuid;
  what text;
begin
  perform core.list_entry(e, p_id, false);
  rep := core.list_entry(e, p_replacement, true);
  if p_replacement = p_id or not (rep ->> 'active')::boolean then
    raise exception using errcode = 'P0001', message = 'list.replacement_invalid';
  end if;
  req := audit.begin('ui', 'list.retired', pg_catalog.jsonb_build_object('list', p_list), why);
  begin
    for r in
      select c.conrelid::regclass::text as tbl, a.attname::text as col,
             exists (select 1 from pg_catalog.pg_attribute d where d.attrelid = c.conrelid and d.attname = 'deleted_at'
                     and not d.attisdropped) as soft
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = pg_catalog.to_regclass(e.table_name) and pg_catalog.cardinality(c.conkey) = 1
      order by 1, 2
    loop
      if core.is_history(r.tbl) or exists (select 1 from core.entity x where x.table_name = r.tbl and x.active and x.is_list) then
        execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1%s', r.tbl, r.col,
                                  case when r.soft then ' and t.deleted_at is null' else '' end)
          into n using p_id;
        if core.is_history(r.tbl) then kept := kept + n; else defs := defs + n; end if;
        continue;
      end if;
      -- rows waiting in Recently deleted move too, so a restore brings them back on the replacement (QA-97)
      gone := 0;
      if r.soft then
        execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1 and t.deleted_at is not null',
                                  r.tbl, r.col)
          into gone using p_id;
      end if;
      execute pg_catalog.format('update %s t set %I = $2 where t.%I = $1', r.tbl, r.col, r.col)
        using p_id, p_replacement;
      get diagnostics n = row_count;
      moved := moved + n - gone;
      moved_removed := moved_removed + gone;
    end loop;
  exception
    when unique_violation or exclusion_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = '23505', message = 'list.retire_blocked_by_duplicate', detail = what;
    when foreign_key_violation or check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'list.retire_blocked_by_rule', detail = what;
  end;
  perform audit.write_fields(e.table_name, p_id, '{"active": false}');
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'moved_removed', moved_removed, 'kept_in_history', kept,
                                       'kept_in_lists', defs, 'request_id', req);
end
$$;

-- ================================================================ Recently deleted, in Arabic too (QA)
-- core.recently_deleted as P3-6d wrote it, each row with its Arabic name where its record has one.
create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  e core.entity;
  label text;
  label_ar text;
  part jsonb;
  acc jsonb := '[]';
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  for e in
    select x.* from core.entity x
    where x.active and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(x.table_name)
                                 and a.attname = 'deleted_at' and not a.attisdropped)
    order by x.key
  loop
    select pg_catalog.format('t.%I::text', a.attname) into label
    from pg_catalog.unnest(array['trade_name_en', 'title', 'name_en', 'full_name_en', 'original_name', 'key', 'value_raw',
                                 'body', 'email', 'ref']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    select pg_catalog.format('t.%I::text', a.attname) into label_ar
    from pg_catalog.unnest(array['trade_name_ar', 'name_ar', 'full_name_ar']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(''entity'', $1, ''id'', t.id, ''label'', %s,'
      || ' ''label_ar'', coalesce(%s, %s), ''deleted_at'', t.deleted_at, ''deleted_by'', t.deleted_by,'
      || ' ''reason'', t.delete_reason)), ''[]''::jsonb)'
      || ' from %s t where t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and authz.can_see_as($3, $4, t.id)',
      coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'), coalesce(label, 'null::text'),
      pg_catalog.to_regclass(e.table_name))
      into part using e.key, days, me, e.table_name;
    acc := acc || part;
  end loop;
  return coalesce((select pg_catalog.jsonb_agg(x order by (x ->> 'deleted_at')::timestamptz desc)
                   from (select x from pg_catalog.jsonb_array_elements(acc) x
                         order by (x ->> 'deleted_at')::timestamptz desc
                         limit greatest(1, least(coalesce(p_limit, 100), 500))) y(x)), '[]'::jsonb);
end
$$;

-- ================================================================ setting defaults, one function (V155, V161)
-- The registry sync's defaults: a new setting's default, written once as a company-wide row from the floor date (it
-- answers for every past day); a changed default, as a new company-wide row from today, only while no admin value is
-- in force after the last default (the rows before keep the past as it was); a default changed twice in a day keeps
-- the later one. Never over an admin's value. `p_defaults`: [{key, value}]. Answers how many rows it wrote.
create function core.setting_defaults_sync(p_defaults jsonb) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n int;
  k int;
begin
  insert into core.setting (key, department_id, value, valid_from, reason)
  select d ->> 'key', null, d -> 'value', date '2000-01-01', 'default'
  from pg_catalog.jsonb_array_elements(p_defaults) d
  where not exists (select 1 from core.setting s where s.key = d ->> 'key');
  get diagnostics n = row_count;
  update core.setting s set deleted_at = pg_catalog.now(), delete_reason = 'default changed again'
  from pg_catalog.jsonb_array_elements(p_defaults) d
  where s.key = d ->> 'key' and s.department_id is null and s.deleted_at is null and s.reason = 'default'
    and s.valid_from = core.riyadh_today() and s.valid_from > date '2000-01-01' and s.value is distinct from d -> 'value'
    and not exists (select 1 from core.setting x where x.key = s.key and x.department_id is null
                    and x.deleted_at is null and x.valid_from > s.valid_from);
  insert into core.setting (key, department_id, value, valid_from, reason)
  select d ->> 'key', null, d -> 'value', core.riyadh_today(), 'default'
  from pg_catalog.jsonb_array_elements(p_defaults) d
  cross join lateral (select s.reason, s.value, s.valid_from from core.setting s
                      where s.key = d ->> 'key' and s.department_id is null and s.deleted_at is null
                      order by s.valid_from desc limit 1) cur
  where cur.reason = 'default' and cur.value is distinct from d -> 'value' and cur.valid_from < core.riyadh_today();
  get diagnostics k = row_count;
  return n + k;
end
$$;
revoke all on function core.setting_defaults_sync(jsonb) from public;

-- ================================================================ every department, team and role has its Arabic name (QA)
-- The trigger of P3-6d refuses a save without one, so a row made before it could not be changed at all. The seeded
-- department takes its Arabic name; any other takes its English name until an admin writes the Arabic.
select audit.begin('system', 'org.names_ar_backfilled');
update core.department set name_ar = case when code = 'commercial' then 'التجاري' else name_en end
where name_ar is null or pg_catalog.btrim(name_ar) = '';
update core.team set name_ar = name_en where name_ar is null or pg_catalog.btrim(name_ar) = '';
update core.role set name_ar = name_en where name_ar is null or pg_catalog.btrim(name_ar) = '';
select audit.end();
