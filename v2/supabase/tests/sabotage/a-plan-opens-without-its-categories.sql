-- Sabotage: a-plan-opens-without-its-categories
-- Breaks: sql:ACH-07
-- Expect: the first plan starts with the starting categories
-- A first plan opens empty, without the starting categories (V66, V90, V99, V505).
create or replace function perf.plan_open(p_department uuid, p_year int, p_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  src uuid;
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
  select p.id into src from perf.plan p
  where p.department_id = p_department and p.deleted_at is null
  order by (p.year < p_year) desc, pg_catalog.abs(p.year - p_year), p.year
  limit 1;
  req := audit.begin('ui', 'plan.opened', pg_catalog.jsonb_build_object('year', p_year));
  insert into perf.plan (department_id, year, name, copied_from_plan_id)
  values (p_department, p_year,
          coalesce(nullif(pg_catalog.btrim(p_name), ''),
                   (select d.name_en from core.department d where d.id = p_department) || ' ' || p_year),
          src)
  returning id into pid;
  if src is null then
    null;
  else
    insert into perf.achievement_category (plan_id, code, name_en, name_ar, is_money_link, has_deal_value,
                                           required_ref_system_id, line_template_en, line_template_ar, sort, active)
    select pid, c.code, c.name_en, c.name_ar, c.is_money_link, c.has_deal_value, c.required_ref_system_id,
           c.line_template_en, c.line_template_ar, c.sort, c.active
    from perf.achievement_category c where c.plan_id = src and c.deleted_at is null;
    update perf.achievement_category n set parent_id = np.id
    from perf.achievement_category o
    join perf.achievement_category op on op.id = o.parent_id
    join perf.achievement_category np on np.plan_id = pid and np.code = op.code and np.deleted_at is null
    where o.plan_id = src and o.deleted_at is null and o.parent_id is not null
      and n.plan_id = pid and n.code = o.code and n.deleted_at is null;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', 1, 'request_id', req);
end
$$;
