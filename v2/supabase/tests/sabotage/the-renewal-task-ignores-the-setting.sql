-- Sabotage: the-renewal-task-ignores-the-setting
-- Breaks: sql:CTR-04
-- Expect: the setting off: none
-- The job makes renewal tasks while partner.contract_renewal_task is off.
create or replace function work.make_renewal_tasks(p_day date default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  today date := coalesce(p_day, core.riyadh_today());
  c partner.contract;
  owner uuid;
  team uuid;
  tid uuid;
  made int := 0;
begin
  for c in select k.* from partner.contract k
           where k.deleted_at is null and k.end_on >= today and work.renewal_due(k, today)
           order by k.end_on, k.id loop
    owner := work.renewal_owner(c);
    continue when owner is null;
    team := (select p.team_id from core.person p where p.id = owner);
    perform audit.begin('job', 'task.renewal_made', pg_catalog.jsonb_build_object('contract', c.title));
    insert into work.task (number, title, owner_id, team_id, department_id, status_id, type_id, work_type, due_on,
                           partner_id, origin, happened_on)
    values (core.format_number('TSK', pg_catalog.date_part('year', today)::int,
                               core.next_number('task', pg_catalog.date_part('year', today)::int)),
            work.renewal_title(c), owner, team, (select m.department_id from core.team m where m.id = team),
            (select s.id from work.task_status s where s.is_default and s.deleted_at is null),
            work.list_id('work.task_type', 'follow_up'), 'client', c.end_on, c.partner_id, 'alert', today)
    returning id into tid;
    update partner.contract set renewal_task_id = tid, renewal_end_on = c.end_on where id = c.id;
    perform notify.push_assigned(owner, 'assigned', 'work.task', tid);
    perform audit.end();
    made := made + 1;
  end loop;
  return made;
end
$$;
