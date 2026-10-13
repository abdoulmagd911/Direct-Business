-- Sabotage: reports-to-a-switched-off-person
-- Breaks: sql:PPL-05
-- Expect: nobody reports to a switched-off person
-- A person is made to report to someone who can no longer work here (OLD-006, V465).
create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.account <> 'team_member' and (new.team_id is not null or new.manager_id is not null) then
    raise exception using errcode = 'P0001', message = 'person.account_in_no_team', detail = new.account;
  end if;
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  if new.team_id is distinct from old.team_id and new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.active) then
    raise exception using errcode = 'P0001', message = 'person.team_inactive';
  end if;
  if new.manager_id is distinct from old.manager_id and new.manager_id is not null
     and not core.is_team_member(new.manager_id) then
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
