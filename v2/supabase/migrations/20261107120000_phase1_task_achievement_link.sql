-- Phase 1 (lifecycle gaps) — link achievements to tasks + the persistent strip.
-- (a) perf.achievement_log accepts 'source_task_id' (the column already exists on
-- perf.achievement since 20261002040000 but was never written): a new variable
-- v_task_id carries it — sid is NOT reused, it holds the MoU status-change id
-- inserted as mou_status_id. (b) api.task_delegate hands a task to someone else:
-- work.tasks_assign owns the move (work.task_update's whitelist rejects owner_id),
-- core.note_add(kind 'update') writes the note, and the delegator follows the task
-- server-side. (c) work.task_row returns the task's star, its nudge dismissal and
-- whether an achievement already links to it, so the record can draw the star
-- toggle and the strip. Forward-only: nothing already on v2/main is edited here.

alter table work.task
  add column dismissed_from_nudge boolean not null default false;
comment on column work.task.dismissed_from_nudge is
  'Phase 1: "Not an achievement" on the persistent strip — the task leaves the unlogged list until restored.';

-- perf.achievement_log, re-issued with exactly one change: 'source_task_id' joins
-- the whitelist and is read into the insert through v_task_id. Everything else is
-- 20261002040000_perf_achievements.sql as it stands.
create or replace function perf.achievement_log(p_values jsonb, p_refs jsonb default null, p_participants uuid[] default null)
  returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'own');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  refs jsonb := coalesce(p_refs, '[]'::jsonb);
  k text;
  owner uuid := coalesce(nullif(v ->> 'owner_id', '')::uuid, me);
  day date := nullif(v ->> 'happened_on', '')::date;
  yr int;
  dept uuid;
  pl uuid;
  c perf.achievement_category;
  pid uuid := nullif(v ->> 'partner_id', '')::uuid;
  rep uuid := nullif(v ->> 'repeat_of', '')::uuid;
  v_task_id uuid := nullif(v ->> 'source_task_id', '')::uuid;
  side text := nullif(v ->> 'side', '');
  prospect boolean;
  aid uuid := gen_random_uuid();
  num text;
  sid uuid;
  req uuid;
  r jsonb;
  pp uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' or pg_catalog.jsonb_typeof(refs) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('category', 'title', 'notes', 'happened_on', 'partner_id', 'count', 'deal_value', 'owner_id',
                 'use_as_example', 'before_value', 'after_value', 'repeat_of', 'side', 'source_task_id') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if owner is distinct from me and authz.level_of(me, 'kpis') < 'full' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full')::text;
  end if;
  if day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  select p.department_id into dept from core.person p where p.id = owner;
  if dept is null or not perf.sees_department(me, dept) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'core.person';
  end if;
  yr := pg_catalog.date_part('year', coalesce(day, core.riyadh_today()))::int;
  pl := perf.plan_of(dept, yr);
  if pl is null then
    raise exception using errcode = 'P0001', message = 'achievement.no_plan', detail = yr::text;
  end if;
  c := perf.category_in(pl, v ->> 'category');
  if c.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = coalesce(v ->> 'category', '');
  end if;
  if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  -- Phase 1: the task an achievement came from must be a live task the logger sees.
  if v_task_id is not null and not exists (
       select 1 from work.task x where x.id = v_task_id and x.deleted_at is null
         and work.row_level('work.task', v_task_id, me) >= 'view') then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.task';
  end if;
  -- V521: an MoU with an organisation names the side it was signed with.
  prospect := perf.category_sets_prospect(c.id);
  if side is not null and side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'achievement.side_required';
  end if;
  if prospect and pid is not null and side is null then
    raise exception using errcode = 'P0001', message = 'achievement.side_required';
  end if;
  -- V531: "This is a new one" names the earlier achievement it repeats — one the person sees, same organisation and code.
  if rep is not null and not exists (
       select 1 from perf.achievement e join perf.achievement_category ec on ec.id = e.category_id
       where e.id = rep and e.deleted_at is null and e.partner_id is not distinct from pid and ec.code = c.code
         and perf.sees_department(me, e.department_id)) then
    raise exception using errcode = 'P0001', message = 'achievement.repeat_invalid';
  end if;
  if c.required_ref_system_id is not null and not exists (
       select 1 from pg_catalog.jsonb_array_elements(refs) x join work.ref_system s on s.key = x ->> 'system'
       where s.id = c.required_ref_system_id and nullif(pg_catalog.btrim(x ->> 'value'), '') is not null) then
    raise exception using errcode = 'P0001', message = 'achievement.ref_required',
      detail = (select s.key from work.ref_system s where s.id = c.required_ref_system_id);
  end if;
  req := audit.begin('ui', 'achievement.logged', pg_catalog.jsonb_build_object('category', c.code));
  perform audit.happened(day);
  num := perf.number_for(yr);
  if prospect and day is not null then
    sid := perf.mou_prospect(aid, num, pid, side, day);
  end if;
  begin
    insert into perf.achievement (id, number, plan_id, department_id, category_id, partner_id, title, notes, count,
                                  before_value, after_value, deal_value, happened_on, owner_id, use_as_example, origin,
                                  repeat_of, source_task_id, mou_side, mou_status_id)
    values (aid, num, pl, dept, c.id, pid, pg_catalog.btrim(v ->> 'title'),
            nullif(pg_catalog.btrim(v ->> 'notes'), ''), coalesce((v ->> 'count')::int, 1),
            (v ->> 'before_value')::numeric, (v ->> 'after_value')::numeric, (v ->> 'deal_value')::numeric, day, owner,
            coalesce((v ->> 'use_as_example')::boolean, false), 'person', rep, v_task_id,
            case when prospect then side end, sid);
  exception when check_violation or not_null_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check'));
  end;
  for r in select x from pg_catalog.jsonb_array_elements(refs) x loop
    perform perf.ref_insert(aid, r ->> 'system', r ->> 'value', r ->> 'url');
  end loop;
  foreach pp in array coalesce(p_participants, '{}') loop
    continue when pp = owner;
    insert into perf.achievement_participant (achievement_id, person_id) values (aid, pp) on conflict do nothing;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', aid, 'version', 1, 'request_id', req,
                                       'number', (select a.number from perf.achievement a where a.id = aid));
end
$$;

-- work.task_row, re-issued with three fields added to the cancelled-reason body
-- (20261101120000, copied exactly otherwise): 'starred' so the record can draw the
-- star toggle, 'dismissed_from_nudge' and 'has_achievement' so the strip shows only
-- until the task is logged or dismissed.
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
    'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'cancelled_reason', t.cancelled_reason, 'version', t.version,
    'starred', t.starred, 'dismissed_from_nudge', t.dismissed_from_nudge,
    'has_achievement', exists (select 1 from perf.achievement a
                               where a.source_task_id = t.id and a.deleted_at is null),
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

-- Delegate (Phase 1, CUJ 5): hand a task to someone else, with a note. The owner
-- changes through work.tasks_assign — the only owner-change path (work.task_update
-- rejects owner_id) — which also tells the new owner; the note is the task's
-- timeline entry (kind 'update'); the delegator follows the task from then on.
-- One request: the nested audit.begin calls join the delegate's own request.
-- Refused: no note, to someone who cannot be given work here, to oneself, to
-- someone who cannot see the task; giving work to others needs tasks.assign
-- (work.tasks_assign's own rule).
create function work.task_delegate(p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  note jsonb;
  req uuid;
begin
  if nullif(pg_catalog.btrim(p_note), '') is null then
    raise exception using errcode = 'P0001', message = 'task.delegate_note_required';
  end if;
  if p_to is null or not work.person_ok(p_to) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_to::text;
  end if;
  if p_to = me then
    raise exception using errcode = 'P0001', message = 'task.delegate_to_yourself';
  end if;
  if not authz.can_see_as(p_to, 'work.task', p_id) then
    raise exception using errcode = 'P0001', message = 'task.delegate_cannot_see', detail = p_to::text;
  end if;
  req := audit.begin('ui', 'task.delegated', pg_catalog.jsonb_build_object('number', t.number));
  perform work.tasks_assign(array[p_id], p_to, p_note);
  note := core.note_add('task', p_id, 'update', p_note);
  insert into notify.follow (person_id, entity_table, entity_id) values (me, 'work.task', p_id)
    on conflict do nothing;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'note_id', note ->> 'id', 'owner_id', p_to);
end
$$;
comment on function work.task_delegate(uuid, uuid, text) is
  'Phase 1: delegate a task — owner change via work.tasks_assign, note via core.note_add, delegator follows.';

create function api.task_delegate(p_id uuid, p_to uuid, p_note text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_delegate(p_id, p_to, p_note) $$;
comment on function api.task_delegate(uuid, uuid, text) is
  'Phase 1: hand a task to someone else, with a note; the delegator follows it.';
revoke all on function work.task_delegate(uuid, uuid, text), api.task_delegate(uuid, uuid, text) from public;
grant execute on function work.task_delegate(uuid, uuid, text), api.task_delegate(uuid, uuid, text) to authenticated;

-- Dismiss (or restore) a closed task from the nudge: "Not an achievement" on the
-- persistent strip. Whoever may change the task dismisses it; setting the value it
-- already has changes nothing and logs nothing (the star pattern).
create function work.task_nudge_dismiss(p_id uuid, p_dismissed boolean) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_id);
  req uuid;
begin
  if p_dismissed is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  if t.dismissed_from_nudge = p_dismissed then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null, 'dismissed_from_nudge', t.dismissed_from_nudge,
                                         'version', t.version);
  end if;
  req := audit.begin('ui', case when p_dismissed then 'task.nudge_dismissed' else 'task.nudge_restored' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  update work.task set dismissed_from_nudge = p_dismissed where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'dismissed_from_nudge', p_dismissed,
                                       'version', (select x.version from work.task x where x.id = p_id));
end
$$;
comment on function work.task_nudge_dismiss(uuid, boolean) is
  'Phase 1: dismiss a closed task from the achievement nudge, or restore it.';

create function api.task_nudge_dismiss(p_id uuid, p_dismissed boolean) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_nudge_dismiss(p_id, p_dismissed) $$;
comment on function api.task_nudge_dismiss(uuid, boolean) is
  'Phase 1: dismiss a closed task from the achievement nudge, or restore it.';
revoke all on function work.task_nudge_dismiss(uuid, boolean), api.task_nudge_dismiss(uuid, boolean) from public;
grant execute on function work.task_nudge_dismiss(uuid, boolean), api.task_nudge_dismiss(uuid, boolean) to authenticated;
