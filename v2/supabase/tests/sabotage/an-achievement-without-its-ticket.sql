-- Sabotage: an-achievement-without-its-ticket
-- Breaks: sql:ACH-01
-- Expect: an integration needs its Product ticket
-- A category's required reference is not asked, so an integration is saved without its Product ticket (V99).
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
  aid uuid;
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
                 'use_as_example', 'before_value', 'after_value') then
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
  if false and c.required_ref_system_id is not null and not exists (
       select 1 from pg_catalog.jsonb_array_elements(refs) x join work.ref_system s on s.key = x ->> 'system'
       where s.id = c.required_ref_system_id and nullif(pg_catalog.btrim(x ->> 'value'), '') is not null) then
    raise exception using errcode = 'P0001', message = 'achievement.ref_required',
      detail = (select s.key from work.ref_system s where s.id = c.required_ref_system_id);
  end if;
  req := audit.begin('ui', 'achievement.logged', pg_catalog.jsonb_build_object('category', c.code));
  perform audit.happened(day);
  begin
    insert into perf.achievement (plan_id, department_id, category_id, partner_id, title, notes, count, before_value,
                                  after_value, deal_value, happened_on, owner_id, use_as_example, origin)
    values (pl, dept, c.id, pid, pg_catalog.btrim(v ->> 'title'), nullif(pg_catalog.btrim(v ->> 'notes'), ''),
            coalesce((v ->> 'count')::int, 1), (v ->> 'before_value')::numeric, (v ->> 'after_value')::numeric,
            (v ->> 'deal_value')::numeric, day, owner, coalesce((v ->> 'use_as_example')::boolean, false), 'person')
    returning id into aid;
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
  return pg_catalog.jsonb_build_object('id', aid, 'version', 1, 'request_id', req);
end
$$;
