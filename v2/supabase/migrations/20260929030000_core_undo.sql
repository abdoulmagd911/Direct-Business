-- v2 undo, concurrency and history (P3-6, part 1): TECH-SPEC §3.3, A16, D7; V127, V128. Every function the Data API
-- reaches is a security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ entities (V127)
-- The tables whose records are logged, undone, followed and linked (/r/<key>/<id>), written by the registry sync from
-- each module's `entities`: the page whose Full lets a manager undo any change to it, and who owns a record — a column
-- of the row holding a person's id, or a function (uuid) → setof uuid.
create table core.entity (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  table_name text not null unique check (table_name ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
  page_key text references core.page (key),
  owners text check (owners ~ '^([a-z][a-z0-9_]*|[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)$'),
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id),
  version int not null default 1
);
alter table core.entity enable row level security;
comment on table core.entity is 'A record type: its table, its page (undo by Full) and its owners (§3.3) — synced from the registry.';
select audit.track('core.entity');
select core.index_foreign_keys('core');

-- A registry entry that names a table that does not exist, or owners that are neither a column of it nor a function,
-- fails the sync's migration instead of failing later.
create function core.entity_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t regclass := pg_catalog.to_regclass(new.table_name);
begin
  if t is null then
    raise exception using errcode = 'P0001', message = 'entity.unknown_table', detail = new.table_name;
  end if;
  if new.owners is not null and (
       (pg_catalog.strpos(new.owners, '.') > 0 and pg_catalog.to_regprocedure(new.owners || '(uuid)') is null)
       or (pg_catalog.strpos(new.owners, '.') = 0 and not exists (
             select 1 from pg_catalog.pg_attribute a
             where a.attrelid = t and a.attname = new.owners and a.attnum > 0 and not a.attisdropped))) then
    raise exception using errcode = 'P0001', message = 'entity.bad_owners', detail = new.owners;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on core.entity for each row execute function core.entity_guard();

-- The people who own a record (§3.3): told of changes by someone else; may undo a change to it within the window.
create function core.owners_of(p_table text, p_id uuid) returns uuid[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  o uuid[];
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.owners is null then
    return '{}';
  elsif pg_catalog.strpos(e.owners, '.') > 0 then
    execute pg_catalog.format('select pg_catalog.array_agg(x) from %s($1) x',
                              pg_catalog.to_regprocedure(e.owners || '(uuid)')::regproc)
      into o using p_id;
  else
    execute pg_catalog.format('select pg_catalog.array_remove(array[t.%I]::uuid[], null) from %s t where t.id = $1',
                              e.owners, pg_catalog.to_regclass(p_table))
      into o using p_id;
  end if;
  return coalesce(o, '{}');
end
$$;

-- ================================================================ concurrency: version checks with a field merge (A14)
-- A write names the version it read. Same version: fine. Someone saved in between: fine when none of the fields this
-- write changes was changed since (the edits merge); else refused, naming the field, who and when (40001).
create function core.check_version(p_table text, p_id uuid, p_expected int, p_fields text[]) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  cur int;
  hit record;
begin
  if p_expected is null then
    raise exception using errcode = 'P0001', message = 'common.version_required';
  end if;
  execute pg_catalog.format('select t.version from %s t where t.id = $1', pg_catalog.to_regclass(p_table))
    into cur using p_id;
  if cur is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if cur = p_expected then
    return;
  end if;
  select f.field, c.at, q.actor_id into hit
  from audit.change c
  join audit.request q on q.id = c.request_id
  cross join lateral pg_catalog.unnest(c.fields) f(field)
  where c.table_name = p_table and c.row_id = p_id and c.version_after > p_expected and f.field = any (p_fields)
  order by c.id desc
  limit 1;
  if hit.field is not null then
    raise exception using errcode = '40001', message = 'common.conflict',
      detail = pg_catalog.jsonb_build_object('field', hit.field, 'by', hit.actor_id, 'at', hit.at,
                                             'version', cur)::text;
  end if;
end
$$;

-- ================================================================ undo (§3.3, D7)
-- A logged value is compared with the row's current value as JSON text; a time written as text depends on the
-- session's time zone, so the log and the undo both write times in UTC — an undo in another time zone must not see a
-- change that never happened.
alter function audit.capture() set timezone = 'UTC';

-- Writes named fields of one row from a jsonb of values, through the table's own triggers (so the write is stamped
-- and logged under the open request, like any other).
create function audit.write_fields(p_table text, p_id uuid, p_values jsonb) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t regclass := pg_catalog.to_regclass(p_table);
  cols text;
begin
  select pg_catalog.string_agg(pg_catalog.format('%I = (pg_catalog.jsonb_populate_record(null::%s, $2)).%I', k, t, k),
                               ', ')
    into cols
  from pg_catalog.jsonb_object_keys(p_values) k;
  if cols is null then
    return;
  end if;
  execute pg_catalog.format('update %s set %s where id = $1', t, cols) using p_id, p_values;
end
$$;

-- The latest change to a row after a given change, outside the given requests: who changed it since, and when.
create function audit.changed_since(p_table text, p_id uuid, p_after bigint, p_field text, p_not_requests uuid[])
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('entity', p_table, 'id', p_id, 'field', p_field, 'by', q.actor_id, 'at', c.at)
  from audit.change c join audit.request q on q.id = c.request_id
  where c.table_name = p_table and c.row_id = p_id and c.id > p_after and not (c.request_id = any (p_not_requests))
    and (p_field is null or p_field = any (c.fields))
  order by c.id desc
  limit 1
$$;

-- Whether a request changed someone's access: a level or capability override, a role's starting levels or
-- capabilities, or a person's role or whether they may sign in. Undoing one re-grants what was there before, which the
-- three rules of P3-4 would not let a non-admin grant (nobody their own, only an admin an admin, nobody above what they
-- hold) — so only an admin undoes it (V128).
create function audit.touches_access(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from audit.change c
    where c.request_id = p_request
      and (c.table_name in ('core.person_page_level', 'core.person_capability', 'core.role_page_level',
                            'core.role_capability')
           or (c.table_name = 'core.person' and c.fields && array['role_id', 'kind', 'active', 'can_sign_in'])))
$$;

-- Who may undo a request: an admin, or someone with Full on the page of every record type it touched, at any time;
-- within audit.undo_window_hours, the person who made it, or the owner of every record it changed who also has at
-- least Own on that record's page (§3.3, D7). A change of someone's access only an admin undoes (V128).
create function audit.undo_allowed(q audit.request, me uuid) returns boolean
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
  if not exists (select 1 from (select distinct c.table_name from audit.change c where c.request_id = q.id) t
                 left join core.entity e on e.table_name = t.table_name and e.active
                 where e.page_key is null or authz.level_of(me, e.page_key) < 'full') then
    return true;
  end if;
  if q.at <= core.clock() - pg_catalog.make_interval(hours => window_h) then
    return false;
  end if;
  if q.actor_id = me then
    return true;
  end if;
  return not exists (select 1 from audit.change c
                     left join core.entity e on e.table_name = c.table_name and e.active
                     where c.request_id = q.id
                       and (not (me = any (core.owners_of(c.table_name, c.row_id)))
                            or e.page_key is null or authz.level_of(me, e.page_key) < 'own'));
end
$$;

-- Reverts one change, or refuses — the caller's transaction then takes back everything (all or nothing).
--   update, remove, restore: the fields it changed go back, and only where they still hold what it wrote;
--   insert: the row is soft-removed, unless it changed since (outside this request and this undo);
--   a hard delete (never through the API; a stray one is still logged) is not undone.
create function audit.revert_change(c audit.change, p_request uuid, p_undo uuid, me uuid) returns void
language plpgsql volatile security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  cur jsonb;
  f text;
  since jsonb;
begin
  if c.action = 'delete' then
    raise exception using errcode = 'P0001', message = 'undo.cannot_undo_delete', detail = c.table_name;
  end if;
  execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1', pg_catalog.to_regclass(c.table_name))
    into cur using c.row_id;
  if cur is null then
    raise exception using errcode = '40001', message = 'undo.changed_since',
      detail = pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id)::text;
  end if;
  if c.action in ('update', 'remove', 'restore') then
    foreach f in array c.fields loop
      if (cur -> f) is distinct from (c.after -> f) then
        since := audit.changed_since(c.table_name, c.row_id, c.id, f, array[p_request, p_undo]);
        raise exception using errcode = '40001', message = 'undo.changed_since',
          detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id, 'field', f))::text;
      end if;
    end loop;
    perform audit.write_fields(c.table_name, c.row_id,
      (select coalesce(pg_catalog.jsonb_object_agg(k, c.before -> k), '{}'::jsonb) from pg_catalog.unnest(c.fields) k));
  elsif c.action = 'insert' then
    if not (cur ? 'deleted_at') then
      raise exception using errcode = 'P0001', message = 'undo.cannot_remove', detail = c.table_name;
    end if;
    since := audit.changed_since(c.table_name, c.row_id, c.id, null, array[p_request, p_undo]);
    if since is not null or cur ->> 'deleted_at' is not null then
      raise exception using errcode = '40001', message = 'undo.changed_since',
        detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id))::text;
    end if;
    perform audit.write_fields(c.table_name, c.row_id,
      pg_catalog.jsonb_build_object('deleted_at', pg_catalog.now(), 'deleted_by', me, 'delete_reason', 'undo'));
  end if;
end
$$;

-- Marks the request undone by the undo request. Undoing an undo (redo) brings back what that undo had undone: its
-- target is no longer undone — and when that target was itself an undo, the request it had undone is undone again.
create function audit.undo_mark(q audit.request, p_undo uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  back audit.request;
begin
  update audit.request set undo_of = q.id where id = p_undo;
  update audit.request set undone_by = p_undo, undone_at = pg_catalog.now() where id = q.id;
  if q.kind = 'undo' and q.undo_of is not null then
    update audit.request set undone_by = null, undone_at = null where id = q.undo_of returning * into back;
    if back.kind = 'undo' and back.undo_of is not null then
      update audit.request set undone_by = back.id, undone_at = pg_catalog.now() where id = back.undo_of;
    end if;
  end if;
end
$$;

-- Undo a request (the toast's Undo, Activity's Undo): all or nothing, newest change first; itself a request
-- (kind 'undo'), so undoing it is redo. Refusals: 40001 undo.changed_since naming the record, field, who and when;
-- 23505 undo.blocked_by_duplicate naming what holds the value now; 42501 undo.not_allowed; P0001 undo.not_undoable for
-- what the system or a job wrote (the registry sync, an unattended write) — the code, not a person, owns those.
create function audit.undo(p_request uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q audit.request;
  c audit.change;
  req uuid;
  holder text;
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
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req, 'undone', q.id);
end
$$;

-- ================================================================ reading history (§3.3)
-- One record's changes, newest first, for someone who may see that record type: View on its page (for a record
-- without one — My profile — its owners), or an admin.
create function audit.record_history(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into e from core.entity where key = p_entity and active;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
  end if;
  if not (authz.is_admin()
          or (e.page_key is not null and e.page_key <> 'settings.profile' and authz.level_of(me, e.page_key) >= 'view')
          or me = any (core.owners_of(e.table_name, p_id))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'view')::text;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'change_id', c.id, 'request_id', q.id, 'at', c.at, 'actor_id', q.actor_id, 'kind', q.kind,
             'label_key', q.label_key, 'label_args', q.label_args, 'reason', q.reason, 'action', c.action,
             'fields', c.fields, 'before', c.before, 'after', c.after, 'undone', q.undone_by is not null,
             'undo_of', q.undo_of) order by c.id desc)
    from audit.change c join audit.request q on q.id = c.request_id
    where c.table_name = e.table_name and c.row_id = p_id), '[]'::jsonb);
end
$$;

-- Settings → Activity: the whole log, request by request, newest first (Activity · View — admins and managers, §8).
create function audit.activity(p_actor uuid default null, p_entity text default null, p_since timestamptz default null,
                               p_before timestamptz default null, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  tbl text;
begin
  perform authz.require('activity', 'view');
  if p_entity is not null then
    select e.table_name into tbl from core.entity e where e.key = p_entity;
    if tbl is null then
      raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
    end if;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(r order by (r ->> 'at')::timestamptz desc, r ->> 'request_id')
    from (
      select pg_catalog.jsonb_build_object(
               'request_id', q.id, 'at', q.at, 'actor_id', q.actor_id, 'kind', q.kind, 'label_key', q.label_key,
               'label_args', q.label_args, 'reason', q.reason, 'undone_by', q.undone_by, 'undo_of', q.undo_of,
               'changes', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                    'entity', coalesce(e.key, c.table_name), 'id', c.row_id, 'action', c.action,
                                    'fields', c.fields) order by c.id)
                           from audit.change c left join core.entity e on e.table_name = c.table_name
                           where c.request_id = q.id)) as r
      from audit.request q
      where (p_actor is null or q.actor_id = p_actor)
        and (p_since is null or q.at >= p_since)
        and (p_before is null or q.at < p_before)
        and (tbl is null or exists (select 1 from audit.change c where c.request_id = q.id and c.table_name = tbl))
        and exists (select 1 from audit.change c where c.request_id = q.id)
      order by q.at desc, q.id
      limit greatest(1, least(coalesce(p_limit, 50), 500))
    ) page), '[]'::jsonb);
end
$$;

grant execute on function audit.undo(uuid), audit.record_history(text, uuid),
  audit.activity(uuid, text, timestamptz, timestamptz, int) to authenticated;
grant usage on schema audit to authenticated;

-- ================================================================ the door (V124)
create function api.undo(p_request uuid) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select audit.undo(p_request) $$;
comment on function api.undo(uuid) is 'Undo a request — all or nothing; undoing an undo is redo (§3.3).';

create function api.record_history(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select audit.record_history(p_entity, p_id) $$;

create function api.activity(p_actor uuid default null, p_entity text default null, p_since timestamptz default null,
                             p_before timestamptz default null, p_limit int default 50) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select audit.activity(p_actor, p_entity, p_since, p_before, p_limit) $$;

grant execute on function api.undo(uuid), api.record_history(text, uuid),
  api.activity(uuid, text, timestamptz, timestamptz, int) to authenticated;
