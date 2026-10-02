-- Sabotage: a-task-on-another-organisations-project
-- Breaks: sql:TSK-02
-- Expect: a task on another organisation's project is refused
-- A task names one organisation and a project of another.
create or replace function work.task_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p work.project;
begin
  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id
                                     or new.partner_id is distinct from old.partner_id
                                     or new.work_type is distinct from old.work_type) then
    select * into p from work.project where id = new.project_id;
    if p.id is null or p.deleted_at is not null then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
    end if;
    if new.work_type <> p.work_type then
      raise exception using errcode = 'P0001', message = 'task.work_type_not_projects';
    end if;
  end if;
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    if new.owner_id is null and not work.task_is_past(new) then
      raise exception using errcode = 'P0001', message = 'task.owner_required';
    end if;
    perform work.require_person(new.owner_id);
  end if;
  if tg_op = 'INSERT' or new.team_id is distinct from old.team_id then
    select t.department_id into new.department_id from core.team t where t.id = new.team_id and t.active;
    if new.department_id is null then
      raise exception using errcode = 'P0001', message = 'task.team_inactive';
    end if;
  end if;
  return new;
end
$$;
