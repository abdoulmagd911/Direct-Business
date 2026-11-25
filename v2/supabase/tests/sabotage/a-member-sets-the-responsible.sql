-- Sabotage: a-member-sets-the-responsible
-- Breaks: sql:PCE-03
-- Expect: a member does not set the Responsible
-- Anyone who may read KPIs may set who is Responsible for one.
create or replace function perf.kpi_responsible_set(p_plan uuid, p_category uuid, p_person uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
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
