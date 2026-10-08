-- V625 (6), the data model: an achievement category counts for the department's KPIs (`department`, as now) or only
-- for the person's appraisal record (`personal`). A personal category names the one appraisal section it feeds, by the
-- section's code in the appraisal template (P6-3 reads it against the cycle's template as frozen at opening); a
-- department one names none. Admins keep the categories in Settings through the category's own door (V97), never in code.
-- The rule that a personal category has no KPI mapping lands with the mapping itself (P5-4): no category-to-KPI
-- mapping exists yet, and when it is built it refuses a personal category. Forward-only (V103).

alter table perf.achievement_category
  add column scope text not null default 'department' check (scope in ('department', 'personal')),
  add column appraisal_section_code text
    check (appraisal_section_code is null
           or (appraisal_section_code ~ '^[A-Z][A-Z0-9_.-]*$' and pg_catalog.length(appraisal_section_code) <= 40)),
  add constraint achievement_category_personal_has_section
    check ((scope = 'personal') = (appraisal_section_code is not null));

comment on column perf.achievement_category.scope is
  'V625: department (counts for the department''s KPIs, and for the person) or personal (the person''s appraisal only).';
comment on column perf.achievement_category.appraisal_section_code is
  'V625: for a personal category, the code of the appraisal template section it feeds; null for a department one.';

-- A new year's plan copies the nearest plan's categories (V66): a personal category stays personal, with its section.
create or replace function perf.plan_open_inner(p_department uuid, p_year int, p_name text default null) returns uuid
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
                                           required_ref_system_id, line_template_en, line_template_ar, sort, active,
                                           scope, appraisal_section_code)
    select pid, c.code, c.name_en, c.name_ar, c.is_money_link, c.has_deal_value, c.sets_prospect, c.required_ref_system_id,
           c.line_template_en, c.line_template_ar, c.sort, c.active, c.scope, c.appraisal_section_code
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

-- Admins set the two fields where they keep the categories (Settings → Targets, V97): the category's own door, which
-- now also takes scope and appraisal_section_code; a refused pair answers achievement_category.invalid, naming the rule.
create or replace function perf.category_save(p_id uuid, p_plan uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  c perf.achievement_category;
  par uuid;
  sys uuid;
  req uuid;
  cid uuid;
  what text;
  allowed text[] := array['code', 'name_en', 'name_ar', 'parent', 'is_money_link', 'has_deal_value', 'sets_prospect',
                          'required_ref_system',
                          'line_template_en', 'line_template_ar', 'sort', 'active', 'scope', 'appraisal_section_code'];
begin
  if exists (select 1 from pg_catalog.jsonb_object_keys(v) k where k <> all (allowed)) then
    raise exception using errcode = 'P0001', message = 'common.field_unknown',
      detail = (select pg_catalog.string_agg(k, ', ') from pg_catalog.jsonb_object_keys(v) k where k <> all (allowed));
  end if;
  if p_id is not null then
    select * into c from perf.achievement_category x where x.id = p_id and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v ? 'code' and pg_catalog.upper(pg_catalog.btrim(v ->> 'code')) is distinct from c.code then
      raise exception using errcode = 'P0001', message = 'achievement_category.code_fixed';
    end if;
    perform core.check_version('perf.achievement_category', p_id, p_version,
      array(select case k when 'parent' then 'parent_id' when 'required_ref_system' then 'required_ref_system_id' else k end
            from pg_catalog.jsonb_object_keys(v) k));
  elsif p_plan is null or not exists (select 1 from perf.plan p where p.id = p_plan and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if nullif(v ->> 'parent', '') is not null then
    par := (perf.category_in(coalesce(c.plan_id, p_plan), v ->> 'parent')).id;
    if par is null then
      raise exception using errcode = 'P0001', message = 'achievement_category.parent_invalid';
    end if;
  end if;
  if nullif(v ->> 'required_ref_system', '') is not null then
    select r.id into sys from work.ref_system r where r.key = v ->> 'required_ref_system' and r.deleted_at is null;
    if sys is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = v ->> 'required_ref_system';
    end if;
  end if;
  req := audit.begin('ui', case when p_id is null then 'achievement_category.added' else 'achievement_category.changed' end,
                     pg_catalog.jsonb_build_object('code', coalesce(c.code, v ->> 'code')));
  begin
    if p_id is null then
      insert into perf.achievement_category (plan_id, parent_id, code, name_en, name_ar, is_money_link, has_deal_value,
                                             sets_prospect, required_ref_system_id, line_template_en, line_template_ar,
                                             sort, active, scope, appraisal_section_code)
      values (p_plan, par, pg_catalog.upper(pg_catalog.btrim(v ->> 'code')), pg_catalog.btrim(v ->> 'name_en'),
              pg_catalog.btrim(v ->> 'name_ar'), coalesce((v ->> 'is_money_link')::boolean, false),
              coalesce((v ->> 'has_deal_value')::boolean, false), coalesce((v ->> 'sets_prospect')::boolean, false), sys,
              coalesce(nullif(pg_catalog.btrim(v ->> 'line_template_en'), ''), '{title}'),
              coalesce(nullif(pg_catalog.btrim(v ->> 'line_template_ar'), ''), '{title}'),
              coalesce((v ->> 'sort')::int, 0), coalesce((v ->> 'active')::boolean, true),
              coalesce(nullif(pg_catalog.btrim(v ->> 'scope'), ''), 'department'),
              nullif(pg_catalog.btrim(v ->> 'appraisal_section_code'), ''))
      returning id into cid;
    else
      update perf.achievement_category x set
        name_en = case when v ? 'name_en' then pg_catalog.btrim(v ->> 'name_en') else x.name_en end,
        name_ar = case when v ? 'name_ar' then pg_catalog.btrim(v ->> 'name_ar') else x.name_ar end,
        parent_id = case when v ? 'parent' then par else x.parent_id end,
        is_money_link = case when v ? 'is_money_link' then (v ->> 'is_money_link')::boolean else x.is_money_link end,
        has_deal_value = case when v ? 'has_deal_value' then (v ->> 'has_deal_value')::boolean else x.has_deal_value end,
        sets_prospect = case when v ? 'sets_prospect' then (v ->> 'sets_prospect')::boolean else x.sets_prospect end,
        required_ref_system_id = case when v ? 'required_ref_system' then sys else x.required_ref_system_id end,
        line_template_en = case when v ? 'line_template_en' then pg_catalog.btrim(v ->> 'line_template_en') else x.line_template_en end,
        line_template_ar = case when v ? 'line_template_ar' then pg_catalog.btrim(v ->> 'line_template_ar') else x.line_template_ar end,
        sort = case when v ? 'sort' then (v ->> 'sort')::int else x.sort end,
        active = case when v ? 'active' then (v ->> 'active')::boolean else x.active end,
        scope = case when v ? 'scope' then pg_catalog.btrim(v ->> 'scope') else x.scope end,
        appraisal_section_code = case when v ? 'appraisal_section_code'
                                      then nullif(pg_catalog.btrim(v ->> 'appraisal_section_code'), '')
                                      else x.appraisal_section_code end
      where x.id = p_id;
      cid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'achievement_category.code_taken',
        detail = (select x.id::text from perf.achievement_category x
                  where x.plan_id = coalesce(c.plan_id, p_plan) and x.code = pg_catalog.upper(pg_catalog.btrim(v ->> 'code'))
                    and x.deleted_at is null);
    when check_violation or not_null_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'achievement_category.invalid', detail = coalesce(what, '');
  end;
  -- A deal value already typed keeps its category's flag on: switching it off would leave figures nothing can show.
  if exists (select 1 from perf.achievement a join perf.achievement_category x on x.id = a.category_id
             where x.id = cid and not x.has_deal_value and a.deal_value is not null and a.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'achievement_category.deal_values_held';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version',
    (select x.version from perf.achievement_category x where x.id = cid), 'request_id', req);
end
$$;

-- The category list carries the two fields, for Settings and Log achievement.
create or replace function perf.categories(p_plan uuid default null, p_year int default null, p_department uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
  pl uuid := p_plan;
begin
  if pl is null then
    pl := perf.plan_of(coalesce(p_department, (select p.department_id from core.person p where p.id = me)),
                       coalesce(p_year, pg_catalog.date_part('year', core.riyadh_today())::int));
  end if;
  if pl is null or not exists (select 1 from perf.plan p where p.id = pl and p.deleted_at is null
                               and perf.sees_department(me, p.department_id)) then
    return '[]'::jsonb;
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.id, 'plan_id', c.plan_id, 'code', c.code, 'name_en', c.name_en, 'name_ar', c.name_ar,
      'parent_id', c.parent_id, 'parent_code', p.code, 'is_money_link', c.is_money_link, 'has_deal_value', c.has_deal_value,
      'sets_prospect', c.sets_prospect or coalesce(p.sets_prospect, false),
      'required_ref_system', r.key, 'line_template_en', c.line_template_en, 'line_template_ar', c.line_template_ar,
      'sort', c.sort, 'active', c.active, 'scope', c.scope,
      'appraisal_section_code', c.appraisal_section_code, 'version', c.version)
      order by coalesce(p.sort, c.sort), coalesce(p.code, c.code), c.parent_id nulls first, c.sort, c.code)
    from perf.achievement_category c
    left join perf.achievement_category p on p.id = c.parent_id
    left join work.ref_system r on r.id = c.required_ref_system_id
    where c.plan_id = pl and c.deleted_at is null), '[]'::jsonb);
end
$$;
