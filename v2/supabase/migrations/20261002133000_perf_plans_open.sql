-- Every department's plans for 2025 and 2026, so that Log achievement has its categories (V380; the Architect on #151,
-- 2 Oct — found on production: no plan had been opened, so the Category list was empty and nothing could be saved).
-- A plan is opened the one way plan_open opens it — the nearest plan's categories copied, else the seven starting
-- ones (V66, V370) — now as an inner step that both the admin's door and the system's run share. 2025 is past work's
-- first year (V506). Idempotent: a department that already has a plan for a year keeps it untouched. The plans and
-- their categories are reference data: the go-live reset keeps them, or runs perf.plans_open_missing again after it.

-- The opening itself, inside a request the caller holds: no rights asked here.
create function perf.plan_open_inner(p_department uuid, p_year int, p_name text default null) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  src uuid;
  pid uuid;
begin
  select p.id into src from perf.plan p
  where p.department_id = p_department and p.deleted_at is null
  order by (p.year < p_year) desc, pg_catalog.abs(p.year - p_year), p.year
  limit 1;
  insert into perf.plan (department_id, year, name, copied_from_plan_id)
  values (p_department, p_year,
          coalesce(nullif(pg_catalog.btrim(p_name), ''),
                   (select d.name_en from core.department d where d.id = p_department) || ' ' || p_year),
          src)
  returning id into pid;
  if src is null then
    perform perf.categories_seed(pid);
  else
    insert into perf.achievement_category (plan_id, code, name_en, name_ar, is_money_link, has_deal_value, sets_prospect,
                                           required_ref_system_id, line_template_en, line_template_ar, sort, active)
    select pid, c.code, c.name_en, c.name_ar, c.is_money_link, c.has_deal_value, c.sets_prospect, c.required_ref_system_id,
           c.line_template_en, c.line_template_ar, c.sort, c.active
    from perf.achievement_category c where c.plan_id = src and c.deleted_at is null;
    update perf.achievement_category n set parent_id = np.id
    from perf.achievement_category o
    join perf.achievement_category op on op.id = o.parent_id
    join perf.achievement_category np on np.plan_id = pid and np.code = op.code and np.deleted_at is null
    where o.plan_id = src and o.deleted_at is null and o.parent_id is not null
      and n.plan_id = pid and n.code = o.code and n.deleted_at is null;
  end if;
  return pid;
end
$$;

-- Opens a department's plan for a year (Settings → Targets, and Log achievement's empty state — admins): unchanged
-- in what it asks and answers, now through the shared inner step.
create or replace function perf.plan_open(p_department uuid, p_year int, p_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  pid uuid;
  req uuid;
  held uuid;
begin
  if p_department is null or not exists (select 1 from core.department d where d.id = p_department and d.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_year is null or p_year < 2025 or p_year > pg_catalog.date_part('year', core.riyadh_today())::int + 1 then
    raise exception using errcode = 'P0001', message = 'plan.year_invalid', detail = p_year::text;
  end if;
  held := perf.plan_of(p_department, p_year);
  if held is not null then
    raise exception using errcode = '23505', message = 'plan.year_taken', detail = held::text;
  end if;
  req := audit.begin('ui', 'plan.opened', pg_catalog.jsonb_build_object('year', p_year));
  pid := perf.plan_open_inner(p_department, p_year, p_name);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', 1, 'request_id', req);
end
$$;

-- The system's run: every live department without a plan for one of the years gets it, years in order (so a later
-- year copies the earlier one's categories). One system request; a plan already held is never touched. Returns how
-- many plans it opened.
create function perf.plans_open_missing(p_years int[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  y int;
  d uuid;
  k int := 0;
begin
  perform audit.begin('system', 'plan.opened_missing', pg_catalog.jsonb_build_object('years', pg_catalog.to_jsonb(p_years)));
  for y in select distinct x from pg_catalog.unnest(p_years) x where x between 2025 and 2100 order by x loop
    for d in select dep.id from core.department dep where dep.deleted_at is null order by dep.code loop
      if perf.plan_of(d, y) is null then
        perform perf.plan_open_inner(d, y, null);
        k := k + 1;
      end if;
    end loop;
  end loop;
  perform audit.end();
  return k;
end
$$;

select perf.plans_open_missing(array[2025, 2026]);
