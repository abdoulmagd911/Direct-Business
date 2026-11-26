-- Landing 54 — KPI pace (the design session's Batch 3, boards 5–8): one read for the Reports → KPI pace page, and
-- the two things that page needs which the workspace did not hold yet.
--
-- What a KPI is here: a plan's target for one category in one month (perf.target, Landing 6) — the count of
-- achievements expected, and the deal-value total where the category carries one. Its actual is READ, never stored
-- (§3.3): the live, dated achievements of the category (and its sub-categories) whose day falls in the month — the
-- very rows perf.targets counts. Nothing here invents a figure, a person or a KPI.
--
-- What this migration adds:
--   * perf.kpi_responsible — who is Responsible for a plan's category (V405: "Responsible" owns the figures). One
--     live person per plan and category; a person is Responsible for AT MOST THREE KPIs in a plan year, refused at
--     the table (the guard), so no door can pass it.
--   * perf.kpi_responsible_set — sets or clears the Responsible (Full on KPIs, in a department the person sees).
--     No screen calls it yet: the KPI edit screen (board 10) is a later landing; the rule is kept here so that
--     screen cannot be built without it.
--   * perf.working_days / perf.pace_bands / perf.pace_pct / perf.pace_status — the pace rule, one copy:
--       pace = actual ÷ the share of the target due by today, where the share is the working days passed (Sunday to
--       Thursday, today counted) over the month's working days — 19 of 22 passed = 86% of the target is due;
--       a rate KPI (a percentage) is compared with its full target;
--       On track 90% or more · At risk 70–89% · Behind under 70%, judged on the whole percent the page shows.
--   * perf.kpi_pace — the page's read: the month's KPIs with target, actual to date, pace, status, Responsible,
--     the day-by-day figures for the curve, and the initiatives (the projects the month's achievements belong to —
--     an achievement's own project, or the project of the task it was logged from — each with how many).
-- Forward-only (V103). No pushed migration edited; no money touched (a deal value is typed, never Finance money — V505).

create table perf.kpi_responsible (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references perf.plan (id),
  category_id uuid not null references perf.achievement_category (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index kpi_responsible_one_per_kpi on perf.kpi_responsible (plan_id, category_id) where deleted_at is null;
comment on table perf.kpi_responsible is
  'Who is Responsible for a plan''s category KPI (V405): one live person per plan and category, and at most three KPIs per person in a plan year (the guard).';
alter table perf.kpi_responsible enable row level security;
select audit.track('perf.kpi_responsible'::regclass);

-- How many KPIs one person may be Responsible for in a plan year.
create function perf.kpi_responsible_max() returns int
language sql immutable security invoker set search_path = '' as $$ select 3 $$;

-- The category is the plan's live one, and the person is not Responsible for more than three KPIs in the plan's year
-- — at every door, not only the set function. Checked on an insert, on a change of person, plan or category, and on
-- a row brought back from removal. The person's rows are locked for the count, so two requests at once cannot both
-- take the third place.
create function perf.kpi_responsible_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  yr int;
  held int;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'INSERT' or new.person_id is distinct from old.person_id or new.plan_id is distinct from old.plan_id
     or new.category_id is distinct from old.category_id or old.deleted_at is not null then
    select p.year into yr from perf.plan p where p.id = new.plan_id and p.deleted_at is null;
    if yr is null or not exists (select 1 from perf.achievement_category c
                                 where c.id = new.category_id and c.plan_id = new.plan_id and c.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'target.category_invalid';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('perf.kpi_responsible:' || new.person_id::text, 0));
    select pg_catalog.count(*)::int into held
    from perf.kpi_responsible r join perf.plan p on p.id = r.plan_id
    where r.person_id = new.person_id and r.deleted_at is null and p.year = yr and r.id <> new.id;
    if held >= perf.kpi_responsible_max() then
      raise exception using errcode = 'P0001', message = 'kpi.responsible_limit',
        detail = perf.kpi_responsible_max()::text;
    end if;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on perf.kpi_responsible
  for each row execute function perf.kpi_responsible_guard();

-- Sets the Responsible of a plan's category, or clears it (p_person null). The person before is taken off (kept in
-- the change log, never erased). Full on KPIs, in a department the person sees; the Responsible is a live staff
-- member.
create function perf.kpi_responsible_set(p_plan uuid, p_category uuid, p_person uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'full');
  cur perf.kpi_responsible;
  req uuid;
  rid uuid;
begin
  if p_plan is null or not exists (select 1 from perf.plan p where p.id = p_plan and p.deleted_at is null
                                   and perf.sees_department(me, p.department_id)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_category is null or not exists (select 1 from perf.achievement_category c
                                       where c.id = p_category and c.plan_id = p_plan and c.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'target.category_invalid';
  end if;
  if p_person is not null and not exists (select 1 from core.person x where x.id = p_person and x.deleted_at is null
                                          and x.active and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'kpi.responsible_invalid';
  end if;
  select * into cur from perf.kpi_responsible r
  where r.plan_id = p_plan and r.category_id = p_category and r.deleted_at is null
  for update;
  if cur.id is not null and cur.person_id is not distinct from p_person then
    return pg_catalog.jsonb_build_object('id', cur.id, 'person_id', cur.person_id, 'request_id', null);
  end if;
  if cur.id is null and p_person is null then
    return pg_catalog.jsonb_build_object('id', null, 'person_id', null, 'request_id', null);
  end if;
  req := audit.begin('ui', case when p_person is null then 'kpi.responsible_cleared' else 'kpi.responsible_set' end,
                     pg_catalog.jsonb_build_object('plan', p_plan, 'category', p_category));
  if cur.id is not null then
    update perf.kpi_responsible r set deleted_at = pg_catalog.now(), deleted_by = me,
      delete_reason = case when p_person is null then 'cleared' else 'replaced' end
    where r.id = cur.id;
  end if;
  if p_person is not null then
    insert into perf.kpi_responsible (plan_id, category_id, person_id) values (p_plan, p_category, p_person)
    returning id into rid;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'person_id', p_person, 'request_id', req);
end
$$;

-- The working days from one day to another, both counted: Sunday to Thursday (the Saudi working week).
create function perf.working_days(p_from date, p_to date) returns int
language sql immutable security invoker set search_path = ''
as $$
  select pg_catalog.count(*)::int
  from pg_catalog.generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  where pg_catalog.date_part('dow', d) not in (5, 6)
$$;

-- The pace bands, in whole percent: On track at this or more, At risk at this or more, Behind below.
create function perf.pace_bands() returns jsonb
language sql immutable security invoker set search_path = ''
as $$ select pg_catalog.jsonb_build_object('on_track', 90, 'at_risk', 70) $$;

-- Pace as a whole percent, or null when there is nothing to judge (no target, or nothing due yet). A cumulative KPI
-- is compared with the share of its target due by today; a rate KPI with its full target.
create function perf.pace_pct(p_actual numeric, p_target numeric, p_share numeric, p_rate boolean default false)
returns int
language sql immutable security invoker set search_path = ''
as $$
  select case
    when p_target is null or p_target <= 0 or p_actual is null then null
    when p_rate then pg_catalog.round(100 * p_actual / p_target)::int
    when p_share is null or p_share <= 0 then null
    else pg_catalog.round(100 * p_actual / (p_target * p_share))::int
  end
$$;

-- The status a pace reads as: the three bands, or why there is none.
create function perf.pace_status(p_pct int, p_target numeric, p_share numeric, p_rate boolean default false)
returns text
language sql immutable security invoker set search_path = ''
as $$
  select case
    when p_target is null or p_target <= 0 then 'not_measured'
    when not p_rate and (p_share is null or p_share <= 0) then 'not_started'
    when p_pct is null then 'not_measured'
    when p_pct >= (perf.pace_bands() ->> 'on_track')::int then 'on_track'
    when p_pct >= (perf.pace_bands() ->> 'at_risk')::int then 'at_risk'
    else 'behind'
  end
$$;

-- The KPI pace page's read, for one month (the current Riyadh month when none is named): the KPIs of every plan the
-- reader may see, each with its target, its actual to date, its pace and status, its Responsible, its day-by-day
-- figures and its initiatives; the month's days with the share of a target due by each; and the three counts.
create function perf.kpi_pace(p_month date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
  today date := core.riyadh_today();
  m date := pg_catalog.date_trunc('month', coalesce(p_month, today)::timestamp)::date;
  m_end date := (m + interval '1 month' - interval '1 day')::date;
  total int := perf.working_days(m, m_end);
  passed int := case when today < m then 0 else perf.working_days(m, least(today, m_end)) end;
  share numeric := case when total > 0 then passed::numeric / total else 0 end;
  rows jsonb;
begin
  with ach as (
    -- the achievements that count in this month, with the category they are filed under and its parent
    -- (its project is its own, or the project of the task it was logged from)
    select a.plan_id, a.category_id, ac.parent_id, a.happened_on, a.deal_value,
           coalesce(a.project_id, tk.project_id) as project_id
    from perf.achievement a
    join perf.achievement_category ac on ac.id = a.category_id
    left join work.task tk on tk.id = a.source_task_id and tk.deleted_at is null
    where a.deleted_at is null and not a.draft and a.happened_on >= m and a.happened_on <= m_end
  ),
  tgt as (
    select t.id, t.plan_id, t.category_id, t.target_count, t.target_value, c.code, c.name_en, c.name_ar, c.sort,
           p.department_id, d.name_en as department_en, d.name_ar as department_ar
    from perf.target t
    join perf.plan p on p.id = t.plan_id and p.deleted_at is null
    join perf.achievement_category c on c.id = t.category_id
    join core.department d on d.id = p.department_id
    where t.deleted_at is null and t.month = m and perf.sees_department(me, p.department_id)
  ),
  kpi as (
    -- a target is one KPI by count, and one more by deal value where it names one
    select t.*, x.measure, x.target,
           (select case x.measure when 'count' then pg_catalog.count(*)::numeric
                                  else coalesce(pg_catalog.sum(a.deal_value), 0) end
            from ach a
            where a.plan_id = t.plan_id and (a.category_id = t.category_id or a.parent_id = t.category_id)) as actual
    from tgt t
    cross join lateral (
      select 'count'::text as measure, t.target_count::numeric as target
      where t.target_count > 0 or t.target_value is null
      union all
      select 'value', t.target_value where t.target_value is not null
    ) x
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', k.id::text || ':' || k.measure, 'target_id', k.id, 'plan_id', k.plan_id, 'category_id', k.category_id,
      'code', k.code, 'name_en', k.name_en, 'name_ar', k.name_ar, 'measure', k.measure,
      'department_id', k.department_id, 'department_en', k.department_en, 'department_ar', k.department_ar,
      'target', k.target, 'actual', k.actual,
      'pace', perf.pace_pct(k.actual, k.target, share),
      'status', perf.pace_status(perf.pace_pct(k.actual, k.target, share), k.target, share),
      'responsible', (
        select pg_catalog.jsonb_build_object(
          'id', x.id, 'full_name_en', x.full_name_en, 'full_name_ar', x.full_name_ar, 'nickname_en', x.nickname_en,
          'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar)
        from perf.kpi_responsible r
        join core.person x on x.id = r.person_id
        left join core.person_profile pr on pr.person_id = x.id
        where r.plan_id = k.plan_id and r.category_id = k.category_id and r.deleted_at is null),
      'daily', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('day', g.day, 'value', g.value) order by g.day)
        from (select a.happened_on as day,
                     case k.measure when 'count' then pg_catalog.count(*)::numeric
                                    else coalesce(pg_catalog.sum(a.deal_value), 0) end as value
              from ach a
              where a.plan_id = k.plan_id and (a.category_id = k.category_id or a.parent_id = k.category_id)
              group by a.happened_on) g), '[]'::jsonb),
      'initiatives', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', g.id, 'name', g.name, 'count', g.n)
                                    order by g.n desc, g.name)
        from (select pj.id, pj.name, pg_catalog.count(*)::int as n
              from ach a
              join work.project pj on pj.id = a.project_id and pj.deleted_at is null
              where a.plan_id = k.plan_id and (a.category_id = k.category_id or a.parent_id = k.category_id)
                and work.sees_department(me, pj.department_id)
              group by pj.id, pj.name) g), '[]'::jsonb))
      order by k.department_en, k.sort, k.code, k.measure), '[]'::jsonb)
  into rows
  from kpi k;

  return pg_catalog.jsonb_build_object(
    'month', m, 'today', today, 'working_days', total, 'days_passed', passed, 'share', pg_catalog.round(share, 4),
    'bands', perf.pace_bands(),
    'years', pg_catalog.jsonb_build_array(pg_catalog.date_part('year', today)::int - 2,
                                           pg_catalog.date_part('year', today)::int - 1,
                                           pg_catalog.date_part('year', today)::int),
    'can_edit', authz.level('settings.performance') = 'full',
    'can_see_projects', authz.level('projects') <> 'none',
    'days', (
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'day', d::date, 'working', pg_catalog.date_part('dow', d) not in (5, 6),
        'share', case when total > 0 then pg_catalog.round(perf.working_days(m, d::date)::numeric / total, 4) else 0 end)
        order by d)
      from pg_catalog.generate_series(m::timestamp, m_end::timestamp, interval '1 day') d),
    'counts', pg_catalog.jsonb_build_object(
      'on_track', (select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(rows) r where r ->> 'status' = 'on_track'),
      'at_risk', (select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(rows) r where r ->> 'status' = 'at_risk'),
      'behind', (select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(rows) r where r ->> 'status' = 'behind')),
    'rows', rows);
end
$$;

create function api.kpi_pace(p_month date default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.kpi_pace(p_month) $$;
create function api.kpi_responsible_set(p_plan uuid, p_category uuid, p_person uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.kpi_responsible_set(p_plan, p_category, p_person) $$;
grant execute on function
  perf.kpi_pace(date), perf.kpi_responsible_set(uuid, uuid, uuid), perf.kpi_responsible_max(),
  perf.working_days(date, date), perf.pace_bands(), perf.pace_pct(numeric, numeric, numeric, boolean),
  perf.pace_status(int, numeric, numeric, boolean)
  to authenticated;
grant execute on function api.kpi_pace(date), api.kpi_responsible_set(uuid, uuid, uuid) to authenticated;

select core.index_foreign_keys('perf');
