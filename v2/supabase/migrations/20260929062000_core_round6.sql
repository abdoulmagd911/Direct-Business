-- v2 round-6 rules on what is already built (P3-6d): the owner's decisions of 29 Sep (V96, V97, V400, V401) and the QA
-- audit, landing on P3-1…P3-6 in one step so nothing merged changes silently. The Arabic name is required on
-- departments, teams and roles; the appraisal line is the direct manager; a sign-in link is never deleted; a request
-- carries the day it happened, and nothing dated in the past raises a notice; each record type may have its own
-- visibility rule, used by history, Follow, notices and Activity; Recently deleted with Restore; setting lists that
-- are archived, removed only unused, and retired by replacing them in one request; locked meanings; a settings dry
-- run and the settings log; settings seeded from a floor date. V140–V145. Forward-only (V103).

-- ================================================================ the Arabic name is required (V97; QA-12)
-- A department, team or role is saved only with its Arabic name (refused in words: org.name_ar_required).
create function core.name_ar_required() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.name_ar is null or pg_catalog.btrim(new.name_ar) = '' then
    raise exception using errcode = 'P0001', message = 'org.name_ar_required', detail = tg_table_name;
  end if;
  return new;
end
$$;
create trigger name_ar_required before insert or update on core.department for each row
  execute function core.name_ar_required();
create trigger name_ar_required before insert or update on core.team for each row
  execute function core.name_ar_required();
create trigger name_ar_required before insert or update on core.role for each row
  execute function core.name_ar_required();

-- ================================================================ the appraisal line is the direct manager (V96)
-- Whether a person reports to the signed-in person: their direct manager only — never further up the chain.
create or replace function authz.reports_to(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.manager_id = authz.me() from core.person p where p.id = p_person), false)
$$;
comment on function authz.reports_to(uuid) is 'Whether the person''s direct manager is the signed-in person (V96) — never the whole chain.';

-- ================================================================ a sign-in link is never deleted (QA)
-- Deleting an auth user would silently drop its link to a person (the foreign key cascades): refused, so a person's
-- sign-ins end by being banned (P3-2's allow-list), and their history stays.
create function core.person_auth_kept() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'person_auth.never_deleted',
    detail = 'Ban the sign-in instead; its link to the person stays.';
end
$$;
create trigger never_deleted before delete on core.person_auth for each row execute function core.person_auth_kept();

-- ================================================================ the dates rule (V400)
-- A request carries the day its work happened: today unless the command says otherwise, never after the day it was
-- logged. Past-dated work raises no notices.
alter table audit.request add column happened_on date;
update audit.request set happened_on = (at at time zone 'Asia/Riyadh')::date where happened_on is null;
alter table audit.request alter column happened_on set default core.riyadh_today(),
  alter column happened_on set not null;
comment on column audit.request.happened_on is 'The day the work happened (V400) — decides periods, KPIs and appraisals; never after the day it was logged.';

-- The open request's day, set by a command that takes one (a call made yesterday, a meeting last week).
create function audit.happened(p_on date) returns date
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
begin
  if p_on is null then
    return core.riyadh_today();
  end if;
  if p_on > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  update audit.request set happened_on = p_on where id = r;
  return p_on;
end
$$;

-- ================================================================ each record type's own visibility (V96; QA-05, QA-09)
-- A record type may name its own rule — a function (record id, person) → boolean — and may be private: then only that
-- rule (or its owners, or an admin) lets a person see a record, and Own on its page never counts as View. P6-3's
-- appraisals use it: the employee, their direct manager and admins.
alter table core.entity add column private boolean not null default false,
  add column visible text check (visible ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$');

create or replace function core.entity_guard() returns trigger
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
  if new.visible is not null and pg_catalog.to_regprocedure(new.visible || '(uuid, uuid)') is null then
    raise exception using errcode = 'P0001', message = 'entity.bad_visible', detail = new.visible;
  end if;
  return new;
end
$$;

-- Whether a person may see one record: an admin always; the record type's own rule when it has one; its owners; else,
-- unless the type is private, View (or more) on its page — My profile only its owner.
create function authz.can_see_as(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  ok boolean;
begin
  select * into e from core.entity where table_name = p_table and active;
  if e.id is null or p_person is null then
    return false;
  end if;
  if exists (select 1 from core.person p join core.role r on r.id = p.role_id
             where p.id = p_person and r.is_admin and p.active and p.can_sign_in and p.deleted_at is null) then
    return true;
  end if;
  if e.visible is not null then
    execute pg_catalog.format('select %s($1, $2)', pg_catalog.to_regprocedure(e.visible || '(uuid, uuid)')::regproc)
      into ok using p_id, p_person;
    if coalesce(ok, false) then
      return true;
    end if;
  end if;
  if p_person = any (core.owners_of(p_table, p_id)) then
    return true;
  end if;
  return not e.private and e.page_key is not null and e.page_key <> 'settings.profile'
         and authz.level_of(p_person, e.page_key) >= 'view';
end
$$;

-- The same, for the signed-in person and a record type's key (the screens' question).
create function authz.can_see(p_entity text, p_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select authz.can_see_as(authz.me(), (select e.table_name from core.entity e where e.key = p_entity and e.active), p_id)
$$;
grant execute on function authz.can_see(text, uuid) to authenticated;

-- core.can_see_record as P3-6b wrote it (Follow, and now history), asking the record type's own rule.
create or replace function core.can_see_record(p_entity text, p_id uuid) returns core.entity
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
  if not authz.can_see_as(me, e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'view')::text;
  end if;
  return e;
end
$$;

-- audit.record_history as P3-6a wrote it, asking the same question.
create or replace function audit.record_history(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'change_id', c.id, 'request_id', q.id, 'at', c.at, 'actor_id', q.actor_id, 'kind', q.kind,
             'label_key', q.label_key, 'label_args', q.label_args, 'reason', q.reason, 'action', c.action,
             'fields', c.fields, 'before', c.before, 'after', c.after, 'undone', q.undone_by is not null,
             'undo_of', q.undo_of, 'happened_on', q.happened_on) order by c.id desc)
    from audit.change c join audit.request q on q.id = c.request_id
    where c.table_name = e.table_name and c.row_id = p_id), '[]'::jsonb);
end
$$;

-- audit.activity as P3-6a wrote it: each request shows only the changes to records the reader may see, and a request
-- with none left is not shown.
create or replace function audit.activity(p_actor uuid default null, p_entity text default null,
                                          p_since timestamptz default null, p_before timestamptz default null,
                                          p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('activity', 'view');
  tbl text;
begin
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
               'request_id', q.id, 'at', q.at, 'happened_on', q.happened_on, 'actor_id', q.actor_id, 'kind', q.kind,
               'label_key', q.label_key, 'label_args', q.label_args, 'reason', q.reason, 'undone_by', q.undone_by,
               'undo_of', q.undo_of,
               'changes', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                    'entity', coalesce(e.key, c.table_name), 'id', c.row_id, 'action', c.action,
                                    'fields', c.fields) order by c.id)
                           from audit.change c left join core.entity e on e.table_name = c.table_name
                           where c.request_id = q.id and authz.can_see_as(me, c.table_name, c.row_id))) as r
      from audit.request q
      where (p_actor is null or q.actor_id = p_actor)
        and (p_since is null or q.at >= p_since)
        and (p_before is null or q.at < p_before)
        and (tbl is null or exists (select 1 from audit.change c where c.request_id = q.id and c.table_name = tbl))
        and exists (select 1 from audit.change c where c.request_id = q.id
                    and authz.can_see_as(me, c.table_name, c.row_id))
      order by q.at desc, q.id
      limit greatest(1, least(coalesce(p_limit, 50), 500))
    ) page), '[]'::jsonb);
end
$$;

-- ================================================================ notices: seen records, today's work (V96, V400)
-- notify.push as P3-6b wrote it: nobody is told of a record they may not see, and past-dated work tells nobody.
create or replace function notify.push(p_person uuid, p_kind text, p_entity_table text, p_entity_id uuid,
                                       p_label_key text default null, p_label_args jsonb default null) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  q audit.request;
begin
  select * into q from audit.request where id = r;
  if p_person is null or p_person = q.actor_id or not notify.may_notify(p_person, p_kind)
     or q.happened_on < core.riyadh_today()
     or (p_entity_table is not null and not authz.can_see_as(p_person, p_entity_table, p_entity_id)) then
    return false;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  values (p_person, p_kind, p_entity_table, p_entity_id, r, q.actor_id, p_label_key, p_label_args);
  return true;
end
$$;

-- notify.fan_out as P3-6b wrote it: owners and followers are told only of records they may see, a person the request
-- already told (mentioned, assigned …) is not told twice, and past-dated work tells nobody.
create or replace function notify.fan_out(p_request uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  q audit.request;
  n int;
begin
  select * into q from audit.request where id = p_request;
  if q.id is null or q.kind not in ('ui', 'undo') or q.happened_on < core.riyadh_today() then
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
    and authz.can_see_as(x.person_id, x.table_name, x.row_id)
    and not exists (select 1 from notify.notification m where m.request_id = q.id and m.person_id = x.person_id)
  order by x.person_id, x.pri, x.id;
  get diagnostics n = row_count;
  return n;
end
$$;

-- ================================================================ setting lists: archive, remove, retire (V97; QA-31)
-- Every list can be soft-removed (restorable from Recently deleted) — only while nothing uses it. A value that feeds
-- logic carries a locked meaning: its names stay editable, the meaning never, and it is never removed or retired.
do $$
declare
  t text;
begin
  for t in select e.table_name from core.entity e where e.is_list loop
    execute pg_catalog.format('alter table %s add column deleted_at timestamptz, add column deleted_by uuid'
                              || ' references core.person (id), add column delete_reason text', t);
  end loop;
end $$;
alter table partner.call_outcome add column meaning text check (meaning in ('meeting_set', 'demo_set', 'demo_held'));
create unique index call_outcome_one_per_meaning on partner.call_outcome (meaning) where meaning is not null;
select audit.begin('system', 'list.meanings_seeded');
update partner.call_outcome set meaning = key where key in ('meeting_set', 'demo_set', 'demo_held');
select audit.end();
select core.index_foreign_keys('partner');
select core.index_foreign_keys('work');

-- A declared list whose table has the list's columns and can be soft-removed.
create or replace function core.list_entity(p_list text) returns core.entity
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
begin
  select * into e from core.entity x where x.key = p_list and x.active and x.is_list
    and (select pg_catalog.count(*) from pg_catalog.pg_attribute a
         where a.attrelid = pg_catalog.to_regclass(x.table_name) and a.attnum > 0 and not a.attisdropped
           and a.attname = any (core.list_columns() || array['deleted_at'])) = pg_catalog.cardinality(core.list_columns()) + 1;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown', detail = p_list;
  end if;
  return e;
end
$$;

-- A list's live entries (removed ones never; retired ones only when asked), for every signed-in person.
create or replace function core.list_items(p_list text, p_include_retired boolean default false) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity;
  r jsonb;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  e := core.list_entity(p_list);
  execute pg_catalog.format(
    'select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) - array[''created_at'', ''created_by'', ''updated_at'','
    || ' ''updated_by'', ''deleted_at'', ''deleted_by'', ''delete_reason''] order by t.sort, t.name_en), ''[]''::jsonb)'
    || ' from %s t where t.deleted_at is null and ($1 or t.active)',
    pg_catalog.to_regclass(e.table_name))
    into r using p_include_retired;
  return r;
end
$$;

-- core.list_save as P3-8a wrote it: a locked meaning is never set or changed here, and a removed entry is not saved.
create or replace function core.list_save(p_list text, p_id uuid, p_values jsonb, p_version int default null,
                                          p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  t regclass := pg_catalog.to_regclass(e.table_name);
  cols text[];
  k text;
  cur jsonb;
  rid uuid;
  req uuid;
  what text;
begin
  select pg_catalog.array_agg(a.attname::text) into cols from pg_catalog.pg_attribute a
  where a.attrelid = t and a.attnum > 0 and not a.attisdropped
    and a.attname::text not in ('id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version', 'deleted_at',
                                'deleted_by', 'delete_reason', 'meaning');
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  if p_values ? 'meaning' then
    raise exception using errcode = 'P0001', message = 'list.meaning_locked';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if not (k = any (cols)) then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  begin
    if p_id is null then
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      execute pg_catalog.format('insert into %s (%s) select %s from pg_catalog.jsonb_populate_record(null::%s, $1) x returning id',
        t, (select pg_catalog.string_agg(pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        (select pg_catalog.string_agg('x.' || pg_catalog.quote_ident(c), ', ') from pg_catalog.jsonb_object_keys(p_values) c),
        t)
        into rid using p_values;
    else
      execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1 and t.deleted_at is null', t)
        into cur using p_id;
      if cur is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      if p_values ? 'key' and (p_values -> 'key') is distinct from (cur -> 'key') then
        raise exception using errcode = 'P0001', message = 'list.key_fixed';
      end if;
      perform core.check_version(e.table_name, p_id, p_version,
        (select pg_catalog.array_agg(c) from pg_catalog.jsonb_object_keys(p_values) c where (cur -> c) is distinct from (p_values -> c)));
      req := audit.begin('ui', 'list.saved', pg_catalog.jsonb_build_object('list', p_list), p_reason);
      perform audit.write_fields(e.table_name, p_id, p_values);
      rid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'list.key_taken', detail = p_values ->> 'key';
    when not_null_violation or check_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
  end;
  perform audit.end();
  execute pg_catalog.format('select pg_catalog.jsonb_build_object(''id'', t.id, ''version'', t.version) from %s t where t.id = $1', t)
    into cur using rid;
  return cur || pg_catalog.jsonb_build_object('request_id', req);
end
$$;

-- Where one list entry is used: every live row of every table that refers to it (their foreign keys), counted.
create function core.list_uses(p_table text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  r record;
  n bigint;
  total bigint := 0;
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
    if n > 0 then
      total := total + n;
      uses := uses || pg_catalog.jsonb_build_object('table', r.tbl, 'column', r.col, 'count', n);
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('total', total, 'uses', uses);
end
$$;

-- "Used in": how many live records use a list entry, and where (Settings shows it before any removal).
create function core.list_usage(p_list text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
begin
  return core.list_uses(e.table_name, p_id);
end
$$;

-- A list entry with a locked meaning, or a missing one, is refused; the entry's row otherwise.
create function core.list_entry(e core.entity, p_id uuid, p_locked_ok boolean) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  cur jsonb;
begin
  execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1 and t.deleted_at is null',
                            pg_catalog.to_regclass(e.table_name))
    into cur using p_id;
  if cur is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not p_locked_ok and cur ->> 'meaning' is not null then
    raise exception using errcode = 'P0001', message = 'list.meaning_locked', detail = cur ->> 'meaning';
  end if;
  return cur;
end
$$;

-- Remove an entry nothing uses (soft: Recently deleted restores it). One in use is archived or retired instead.
create function core.list_remove(p_list text, p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.list_entity(p_list);
  me uuid := authz.require(e.page_key, 'full');
  n bigint;
  req uuid;
begin
  perform core.list_entry(e, p_id, false);
  n := (core.list_uses(e.table_name, p_id) ->> 'total')::bigint;
  if n > 0 then
    raise exception using errcode = 'P0001', message = 'list.in_use', detail = n::text;
  end if;
  req := audit.begin('ui', 'list.removed', pg_catalog.jsonb_build_object('list', p_list), p_reason);
  perform audit.write_fields(e.table_name, p_id, pg_catalog.jsonb_build_object('deleted_at', pg_catalog.now(),
    'deleted_by', me, 'delete_reason', p_reason));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- Retire an entry by replacing it (V97): every live record that uses it is moved to the replacement and the entry is
-- archived — one request, with the count, and one Undo. History that is never rewritten (a partner's status changes)
-- keeps the old entry, counted apart.
create function core.list_retire(p_list text, p_id uuid, p_replacement uuid, p_reason text) returns jsonb
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
  kept bigint := 0;
  req uuid;
begin
  perform core.list_entry(e, p_id, false);
  rep := core.list_entry(e, p_replacement, true);
  if p_replacement = p_id or not (rep ->> 'active')::boolean then
    raise exception using errcode = 'P0001', message = 'list.replacement_invalid';
  end if;
  req := audit.begin('ui', 'list.retired', pg_catalog.jsonb_build_object('list', p_list), why);
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col,
           exists (select 1 from pg_catalog.pg_attribute d where d.attrelid = c.conrelid and d.attname = 'deleted_at'
                   and not d.attisdropped) as soft
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = pg_catalog.to_regclass(e.table_name) and pg_catalog.cardinality(c.conkey) = 1
    order by 1, 2
  loop
    if r.tbl = 'partner.status_change' then
      execute pg_catalog.format('select pg_catalog.count(*) from %s t where t.%I = $1 and t.deleted_at is null', r.tbl, r.col)
        into n using p_id;
      kept := kept + n;
      continue;
    end if;
    execute pg_catalog.format('update %s t set %I = $2 where t.%I = $1%s', r.tbl, r.col, r.col,
                              case when r.soft then ' and t.deleted_at is null' else '' end)
      using p_id, p_replacement;
    get diagnostics n = row_count;
    moved := moved + n;
  end loop;
  perform audit.write_fields(e.table_name, p_id, '{"active": false}');
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'kept_in_history', kept, 'request_id', req);
end
$$;

-- ================================================================ Recently deleted (V401; QA-31)
-- What was removed in the last audit.recently_deleted_days (30), among the records the reader may see.
create function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  e core.entity;
  label text;
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
                                 'body', 'email']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    execute pg_catalog.format(
      'select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(''entity'', $1, ''id'', t.id, ''label'', %s,'
      || ' ''deleted_at'', t.deleted_at, ''deleted_by'', t.deleted_by, ''reason'', t.delete_reason)), ''[]''::jsonb)'
      || ' from %s t where t.deleted_at > core.clock() - pg_catalog.make_interval(days => $2)'
      || ' and authz.can_see_as($3, $4, t.id)',
      coalesce(label, 'null::text'), pg_catalog.to_regclass(e.table_name))
      into part using e.key, days, me, e.table_name;
    acc := acc || part;
  end loop;
  return coalesce((select pg_catalog.jsonb_agg(x order by (x ->> 'deleted_at')::timestamptz desc)
                   from (select x from pg_catalog.jsonb_array_elements(acc) x
                         order by (x ->> 'deleted_at')::timestamptz desc
                         limit greatest(1, least(coalesce(p_limit, 100), 500))) y(x)), '[]'::jsonb);
end
$$;

-- Restore a removed record within the window: whoever removed it, an admin, Full on its page, or its owner with Own
-- there; access and sign-in records an admin only. One request (Undo removes it again).
create function core.restore(p_entity text, p_id uuid, p_reason text default null) returns jsonb
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
  if not (authz.is_admin()
          or (e.table_name not in ('core.person_email', 'core.person_auth', 'core.person_page_level',
                                   'core.person_capability', 'core.role_page_level', 'core.role_capability')
              and (who = me
                   or (e.page_key is not null and authz.level_of(me, e.page_key) = 'full')
                   or (me = any (core.owners_of(e.table_name, p_id))
                       and (e.page_key is null or authz.level_of(me, e.page_key) >= 'own'))))) then
    raise exception using errcode = '42501', message = 'restore.not_allowed';
  end if;
  req := audit.begin('ui', 'record.restored', pg_catalog.jsonb_build_object('entity', p_entity), p_reason);
  begin
    perform audit.write_fields(e.table_name, p_id, '{"deleted_at": null, "deleted_by": null, "delete_reason": null}');
  exception when unique_violation or exclusion_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'restore.blocked_by_duplicate', detail = holder;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ settings: a dry run, and the log (V97)
-- What a setting change would do, without doing it: the same checks and the same write, rolled back — the value in
-- force that day before and after, and whether it replaces a change already made for that day.
create function core.setting_preview(p_key text, p_department uuid, p_value jsonb, p_valid_from date default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  res jsonb;
  d text;
  day date;
begin
  begin
    res := core.setting_set(p_key, p_department, p_value, p_valid_from, 'preview');
    raise exception using errcode = 'P0004', message = 'setting.preview_rolled_back',
      detail = pg_catalog.jsonb_build_object('valid_from', res ->> 'valid_from',
                 'value_after', core.setting_at(p_key, p_department, (res ->> 'valid_from')::date))::text;
  exception when sqlstate 'P0004' then
    get stacked diagnostics d = pg_exception_detail;
  end;
  res := d::jsonb;
  day := (res ->> 'valid_from')::date;
  return res || pg_catalog.jsonb_build_object(
    'value_before', core.setting_at(p_key, p_department, day),
    'replaces_same_day', exists (select 1 from core.setting s where s.key = p_key
                                   and s.department_id is not distinct from p_department and s.valid_from = day
                                   and s.deleted_at is null),
    'previewed', true);
end
$$;

-- The settings log (V97): every change made on a Settings page — settings, lists, organisation, access — newest first,
-- kept forever; an admin reverts any of them with Undo (api.undo), at any time.
create function core.settings_log(p_before timestamptz default null, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(r order by (r ->> 'at')::timestamptz desc, r ->> 'request_id')
    from (
      select pg_catalog.jsonb_build_object(
               'request_id', q.id, 'at', q.at, 'actor_id', q.actor_id, 'kind', q.kind, 'label_key', q.label_key,
               'label_args', q.label_args, 'reason', q.reason, 'undone_by', q.undone_by, 'undo_of', q.undo_of,
               'changes', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                    'entity', coalesce(e.key, c.table_name), 'id', c.row_id, 'action', c.action,
                                    'fields', c.fields, 'before', c.before, 'after', c.after) order by c.id)
                           from audit.change c left join core.entity e on e.table_name = c.table_name
                           where c.request_id = q.id)) as r
      from audit.request q
      where q.kind in ('ui', 'undo') and (p_before is null or q.at < p_before)
        and exists (select 1 from audit.change c join core.entity e on e.table_name = c.table_name
                    where c.request_id = q.id and authz.is_settings_page(e.page_key))
      order by q.at desc, q.id
      limit greatest(1, least(coalesce(p_limit, 50), 500))
    ) page), '[]'::jsonb);
end
$$;

-- The seeded defaults answer from the floor date (V97): a default row dated the day it was seeded leaves every
-- earlier day without a value — each gets the same value from 2000-01-01, still never over an admin's.
select audit.begin('system', 'setting.floor_dated');
insert into core.setting (key, department_id, value, valid_from, reason)
select s.key, null, s.value, date '2000-01-01', 'default'
from core.setting s
where s.reason = 'default' and s.department_id is null and s.deleted_at is null and s.valid_from > date '2000-01-01'
  and not exists (select 1 from core.setting x where x.key = s.key and x.department_id is null and x.deleted_at is null
                  and x.valid_from < s.valid_from);
select audit.end();

-- ================================================================ undoing sign-in changes (V128; QA)
-- A change of an allowed e-mail or a sign-in link is access too: only an admin undoes it.
create or replace function audit.touches_access(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from audit.change c
    where c.request_id = p_request
      and (c.table_name in ('core.person_page_level', 'core.person_capability', 'core.role_page_level',
                            'core.role_capability', 'core.person_email', 'core.person_auth')
           or (c.table_name = 'core.person' and c.fields && array['role_id', 'kind', 'active', 'can_sign_in'])))
$$;

-- audit.undo as P3-6a wrote it; its answer now names the people whose sign-ins the undo changed (an e-mail, a link, a
-- switch), so the admin route re-syncs their Auth bans (/auth/admin/undo).
create or replace function audit.undo(p_request uuid) returns jsonb
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

-- ================================================================ grants and the door (V124)
grant execute on function core.list_usage(text, uuid), core.list_remove(text, uuid, text),
  core.list_retire(text, uuid, uuid, text), core.recently_deleted(int), core.restore(text, uuid, text),
  core.setting_preview(text, uuid, jsonb, date), core.settings_log(timestamptz, int) to authenticated;

create function api.list_usage(p_list text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.list_usage(p_list, p_id) $$;
create function api.list_remove(p_list text, p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.list_remove(p_list, p_id, p_reason) $$;
create function api.list_retire(p_list text, p_id uuid, p_replacement uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.list_retire(p_list, p_id, p_replacement, p_reason) $$;
create function api.recently_deleted(p_limit int default 100) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.recently_deleted(p_limit) $$;
create function api.restore(p_entity text, p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.restore(p_entity, p_id, p_reason) $$;
create function api.setting_preview(p_key text, p_department uuid, p_value jsonb, p_valid_from date default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select core.setting_preview(p_key, p_department, p_value, p_valid_from) $$;
create function api.settings_log(p_before timestamptz default null, p_limit int default 50) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.settings_log(p_before, p_limit) $$;
create function api.can_see(p_entity text, p_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$ select authz.can_see(p_entity, p_id) $$;

grant execute on function api.list_usage(text, uuid), api.list_remove(text, uuid, text),
  api.list_retire(text, uuid, uuid, text), api.recently_deleted(int), api.restore(text, uuid, text),
  api.setting_preview(text, uuid, jsonb, date), api.settings_log(timestamptz, int), api.can_see(text, uuid)
  to authenticated;
