-- P5-1 · the Past work grid's door (V400, V491, V504, V506; OLD-059, OLD-PRF-045), for Builder C's grid (P5-2c). One
-- paste is one request: every row a Backfilled task with its own day — or the source report's last day when it has
-- none — the report it came from as its evidence, its owner or Unknown, and its import key, saved once. Nothing it
-- saves raises a notice or a flag, or is ever "logged late". Names are matched by the database, never guessed.
-- V196. Every function the Data API reaches is a security-invoker wrapper (V124). Forward-only (V103).

-- ================================================================ the evidence on a backfilled task (V506, V504)
alter table work.task
  add column source_kind text check (source_kind in ('bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements')),
  add column source_period text check (source_period ~ '^[0-9]{4}-(0[1-9]|1[0-2]|Q[1-4])$'),
  add column date_from_report boolean not null default false,
  add column import_key text check (import_key is null or pg_catalog.length(import_key) between 1 and 300),
  add constraint task_source_on_backfill check ((source_kind is null) = (source_period is null)
                                                and (source_kind is null or origin = 'backfill')
                                                and (not date_from_report or origin = 'backfill'));
create unique index task_import_key on work.task (import_key) where import_key is not null and deleted_at is null;
comment on column work.task.source_kind is 'The report a backfilled task came from (V506): its kind; source_period names which one.';
comment on column work.task.import_key is 'The Past work grid''s key of the row (OLD-PRF-045): one live task per key.';

-- ================================================================ people by name (OLD-059)
-- Each pasted name answered: exactly one person, none, or several. Real names (either language) beat nicknames, which
-- beat e-mail prefixes; the first kind that matches anyone decides. Folded, so every spelling of a name is one.
create function core.people_match(p_names text[]) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  nm text;
  q text;
  hit uuid[];
  out jsonb := '{}'::jsonb;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  foreach nm in array coalesce(p_names, '{}') loop
    q := norm.fold(nm);
    continue when q is null or q = '' or out ? nm;
    select pg_catalog.array_agg(p.id) into hit from core.person p
    where p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null
      and (norm.fold(p.full_name_en) = q or norm.fold(p.full_name_ar) = q);
    if hit is null then
      select pg_catalog.array_agg(p.id) into hit from core.person p
      where p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null
        and (norm.fold(p.nickname_en) = q or norm.fold(p.nickname_ar) = q);
    end if;
    if hit is null then
      select pg_catalog.array_agg(distinct e.person_id) into hit from core.person_email e
      join core.person p on p.id = e.person_id
      where e.deleted_at is null and p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null
        and norm.fold(pg_catalog.split_part(e.email::text, '@', 1)) = q;
    end if;
    out := out || pg_catalog.jsonb_build_object(nm, case
      when hit is null then pg_catalog.jsonb_build_object('kind', 'none')
      when pg_catalog.cardinality(hit) = 1 then pg_catalog.jsonb_build_object('kind', 'one', 'id', hit[1])
      else pg_catalog.jsonb_build_object('kind', 'many') end);
  end loop;
  return out;
end
$$;

-- ================================================================ the keys already held (OLD-PRF-045)
create function work.backfill_keys_held(p_keys text[]) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'view');
begin
  return coalesce((select pg_catalog.jsonb_agg(distinct t.import_key) from work.task t
                   where t.import_key = any (coalesce(p_keys, '{}')) and t.deleted_at is null
                     and work.row_level('work.task', t.id, me) >= 'view'), '[]'::jsonb);
end
$$;

-- ================================================================ one paste, one request (V400, V491, V506)
-- request: { mode: 'tasks', origin: 'backfill', source: { kind, period, last_day }, rows: [{ title, happened_on,
-- date_from_report, kind (a status key; Done when empty), organisation_id, notes, person_id, owner_unknown,
-- import_key }] }. A row for someone else needs tasks.assign; a row with no person is the paster's own; owner_unknown
-- leaves it Unknown. A key already held is left out and named; every other refusal refuses the whole paste, naming
-- the row (its index, from 0).
create function work.backfill_tasks(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  src jsonb := p_request -> 'source';
  last_day date := nullif(src ->> 'last_day', '')::date;
  r jsonb;
  i int := -1;
  day date;
  first_day date;
  owner uuid;
  team uuid;
  st work.task_status;
  pid uuid;
  tid uuid;
  req uuid;
  what text;
  ids uuid[] := '{}';
  held jsonb := '[]'::jsonb;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request -> 'rows') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request -> 'rows') = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if coalesce(p_request ->> 'mode', 'tasks') <> 'tasks' or coalesce(p_request ->> 'origin', 'backfill') <> 'backfill' then
    raise exception using errcode = 'P0001', message = 'backfill.mode_invalid';
  end if;
  if src ->> 'kind' is null or src ->> 'period' is null or last_day is null then
    raise exception using errcode = 'P0001', message = 'backfill.source_required';
  end if;
  if last_day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  req := audit.begin('ui', 'task.backfilled', pg_catalog.jsonb_build_object(
    'count', pg_catalog.jsonb_array_length(p_request -> 'rows'), 'source', src ->> 'kind', 'period', src ->> 'period'));
  for r in select x from pg_catalog.jsonb_array_elements(p_request -> 'rows') x loop
    i := i + 1;
    if nullif(r ->> 'import_key', '') is not null
       and exists (select 1 from work.task t where t.import_key = r ->> 'import_key' and t.deleted_at is null) then
      held := held || pg_catalog.to_jsonb(r ->> 'import_key');
      continue;
    end if;
    day := coalesce(nullif(r ->> 'happened_on', '')::date, last_day);
    if day < date '2025-01-01' then
      raise exception using errcode = 'P0001', message = 'backfill.before_2025', detail = i::text;
    end if;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future', detail = i::text;
    end if;
    owner := case when coalesce((r ->> 'owner_unknown')::boolean, false) then null
                  else coalesce(nullif(r ->> 'person_id', '')::uuid, me) end;
    if owner is distinct from me and not authz.can('tasks.assign') then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    pid := nullif(r ->> 'organisation_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    st := coalesce(work.status_of(nullif(r ->> 'kind', '')), work.status_of('done'));
    if st.id is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = i::text;
    end if;
    team := coalesce((select p.team_id from core.person p where p.id = owner),
                     (select p.team_id from core.person p where p.id = me));
    if team is null then
      raise exception using errcode = 'P0001', message = 'task.team_required', detail = i::text;
    end if;
    begin
      insert into work.task (number, title, notes, owner_id, team_id, department_id, status_id, work_type, partner_id,
                             origin, happened_on, closed_at, closed_by, source_kind, source_period, date_from_report,
                             import_key)
      values (core.format_number('TSK', pg_catalog.date_part('year', day)::int,                      -- V531
                                 core.next_number('task', pg_catalog.date_part('year', day)::int)),
              pg_catalog.btrim(r ->> 'title'), nullif(pg_catalog.btrim(r ->> 'notes'), ''), owner, team,
              (select t.department_id from core.team t where t.id = team), st.id,
              case when pid is null then 'internal' else 'client' end, pid, 'backfill', day,
              case when st.meaning in ('done', 'cancelled') then core.clock() end,
              case when st.meaning in ('done', 'cancelled') then me end,
              src ->> 'kind', src ->> 'period', nullif(r ->> 'happened_on', '') is null,
              nullif(r ->> 'import_key', ''))
      returning id into tid;
    exception
      when check_violation then
        get stacked diagnostics what = constraint_name;
        raise exception using errcode = 'P0001',
          message = case when what in ('task_source_kind_check', 'task_source_period_check', 'task_source_on_backfill')
                         then 'backfill.source_required' else work.task_refused(what) end,
          detail = i::text;
      when not_null_violation then
        raise exception using errcode = 'P0001', message = 'task.title_required', detail = i::text;
    end;
    if st.meaning <> 'not_started' then
      insert into work.task_status_change (task_id, from_status_id, to_status_id, happened_on)
      values (tid, (select s.id from work.task_status s where s.is_default and s.deleted_at is null), st.id, day);
    end if;
    ids := ids || tid;
    first_day := least(coalesce(first_day, day), day);
  end loop;
  if first_day is not null then
    perform audit.happened(least(first_day, core.riyadh_today() - 1));    -- past work tells nobody (V491)
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', case when pg_catalog.cardinality(ids) > 0 then req end,
                                       'saved', pg_catalog.cardinality(ids), 'ids', pg_catalog.to_jsonb(ids),
                                       'held', held);
end
$$;

-- task_row gains the evidence of a backfilled task.
create or replace function work.task_row(t work.task, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', t.id, 'number', t.number, 'title', t.title, 'owner_id', t.owner_id, 'team_id', t.team_id,
    'priority', pr.key, 'priority_en', pr.name_en, 'priority_ar', pr.name_ar, 'executive_directive', pr.meaning is not null,
    'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'meaning', s.meaning,
    'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar, 'work_type', t.work_type,
    'start_on', t.start_on, 'due_on', t.due_on, 'partner_id', t.partner_id, 'project_id', t.project_id,
    'origin', t.origin, 'happened_on', t.happened_on, 'logged_at', t.logged_at, 'closed_at', t.closed_at,
    'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'version', t.version,
    'source_kind', t.source_kind, 'source_period', t.source_period, 'date_from_report', t.date_from_report,
    'import_key', t.import_key,
    'can_edit', work.can_edit_task(p_reader, t),
    'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                          where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
    'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                         from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
  ) || work.task_flags(t)
  from work.task_status s
  left join work.priority pr on pr.id = t.priority_id
  left join work.task_type ty on ty.id = t.type_id
  where s.id = t.status_id
$$;

-- ================================================================ grants and the doors (V124)
grant execute on function core.people_match(text[]), work.backfill_keys_held(text[]), work.backfill_tasks(jsonb)
  to authenticated;
create function api.people_match(p_names text[]) returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.people_match(p_names) $$;
create function api.backfill_keys_held(p_keys text[]) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.backfill_keys_held(p_keys) $$;
create function api.backfill_tasks(p_request jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.backfill_tasks(p_request) $$;
grant execute on function api.people_match(text[]), api.backfill_keys_held(text[]), api.backfill_tasks(jsonb)
  to authenticated;
