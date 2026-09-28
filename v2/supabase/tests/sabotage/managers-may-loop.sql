-- Sabotage: managers-may-loop
-- Breaks: sql:ORG-01
-- Expect: A under C under B under A is a loop
-- The person guard checks the team but no longer walks the manager chain.
create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  return new;
end
$$;
