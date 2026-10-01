-- Sabotage: a-task-seen-by-another-department
-- Breaks: sql:TSK-01
-- Expect: another department does not see it
-- Every department's tasks are everyone's.
create or replace function work.sees_department(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select true or coalesce((
    select coalesce(r.is_admin, false) or p.department_id = p_department
           or exists (select 1 from core.person_department pd
                      where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
    from core.person p left join core.role r on r.id = p.role_id
    where p.id = p_person), false)
$$;
