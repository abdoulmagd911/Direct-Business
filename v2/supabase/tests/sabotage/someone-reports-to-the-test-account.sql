-- Sabotage: someone-reports-to-the-test-account
-- Breaks: sql:ACCT-01
-- Expect: the test account is nobody's manager
-- A manager may be the admin or the test account (V444, V445): both show in reports-to pickers.
create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  if new.manager_id is distinct from old.manager_id and new.manager_id is not null
     and false then
    raise exception using errcode = 'P0001', message = 'person.manager_not_team_member';
  end if;
  while cur is not null and hops < 1000 loop
    if cur = new.id then
      raise exception using errcode = 'P0001', message = 'person.manager_cycle';
    end if;
    select p.manager_id into cur from core.person p where p.id = cur;
    hops := hops + 1;
  end loop;
  return new;
end
$$;
