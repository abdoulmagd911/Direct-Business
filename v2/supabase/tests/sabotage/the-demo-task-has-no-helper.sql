-- Sabotage: the-demo-task-has-no-helper
-- Breaks: sql:ACT-02
-- Expect: with the author's manager as helper
-- The demo task is made without the manager (V406).
create or replace function work.next_step_task() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  demo boolean := exists (select 1 from partner.activity_outcome o where o.id = new.outcome_id and o.meaning = 'demo_set');
  heading text;
  team uuid;
  mgr uuid;
begin
  if new.kind <> 'activity' or new.entity_table <> 'partner.partner' or new.deleted_at is not null
     or new.next_step_on is null or (new.next_step is null and not demo)
     or (select r.kind from audit.request r
         where r.id = nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid) is distinct from 'ui' then
    return new;
  end if;
  heading := pg_catalog.left(coalesce(new.next_step, 'Demo'), 300);
  if new.next_step_task_id is not null then
    update work.task t set title = heading, due_on = new.next_step_on
    where t.id = new.next_step_task_id and t.closed_at is null and t.deleted_at is null
      and (t.title is distinct from heading or t.due_on is distinct from new.next_step_on);
    return new;
  end if;
  select p.team_id, p.manager_id into team, mgr from core.person p where p.id = new.created_by;
  if team is null or not work.person_ok(new.created_by) then
    return new;
  end if;
  insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, partner_id, due_on,
                         origin, happened_on)
  values (core.format_number('TSK', pg_catalog.date_part('year', new.happened_on)::int,                   -- V531
                             core.next_number('task', pg_catalog.date_part('year', new.happened_on)::int)),
          heading, new.created_by, team, (select t.department_id from core.team t where t.id = team),
          (select s.id from work.task_status s where s.is_default and s.deleted_at is null),
          'client', new.entity_id, new.next_step_on, 'next_step', new.happened_on)
  returning id into new.next_step_task_id;
  if false then
    insert into work.task_helper (task_id, person_id) values (new.next_step_task_id, mgr);
    if not work.is_past(new.happened_on) then
      perform notify.push_assigned(mgr, 'helper_added', 'work.task', new.next_step_task_id);
    end if;
  end if;
  return new;
end
$$;
