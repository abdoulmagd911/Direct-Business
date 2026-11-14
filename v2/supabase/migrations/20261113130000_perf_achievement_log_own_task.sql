-- C-perf (owner's audit, 13 Nov): an achievement logged from a task (source_task_id) may name only one of the
-- logger's own tasks — its owner, its creator or a helper (work.task_owners) — unless the logger has Full on KPIs.
-- Before, any task the logger could see was accepted: a Member who saw a teammate's done task could link their own
-- achievement to it, the task then counted as logged (work.task_row has_achievement), and its own people lost the
-- Log achievement strip and menu. The refusal is achievement.task_not_yours. perf.achievement_log is copied from its
-- latest definition (20261107120000_phase1_task_achievement_link.sql) with only that check added; its signature and
-- grants are unchanged. Forward-only (V103).
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
  -- C-perf (13 Nov): below Full on KPIs, it must also be one of the logger's own tasks — its owner, its creator or a
  -- helper (work.task_owners). A colleague's task linked by anyone who could see it counted as logged, so the task's
  -- own people lost its Log achievement strip and menu. Full (a manager logging for someone) keeps any task it sees.
  if v_task_id is not null and authz.level_of(me, 'kpis') < 'full'
     and not exists (select 1 from work.task_owners(v_task_id) o where o = me) then
    raise exception using errcode = 'P0001', message = 'achievement.task_not_yours';
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
