-- Owner 13 Nov (A-tasks): work.tasks_assign never checked that the new owner can see the task. A task given to
-- someone in another department (the Owner picker and Bulk assign offer everyone) kept its team, so its new owner was
-- told of a task they could neither list nor open, and it dropped out of every view of theirs. The door now refuses,
-- in words, an owner who cannot see the task — the same rule Delegate already applies before it calls this door
-- (task.delegate_cannot_see). Someone unavailable is still refused as before (person.unavailable, by the task's
-- guard), so that check runs first. Everything else is copied from 20261109000028_fix03_tasks_assign_own.sql exactly.
-- Forward-only: replaces work.tasks_assign whole.
create or replace function work.tasks_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  i uuid;
  t work.task;
  req uuid;
  k int := 0;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_owner is null then
    raise exception using errcode = 'P0001', message = 'task.owner_required';
  end if;
  foreach i in array p_ids loop
    select * into t from work.task where id = i and deleted_at is null;
    if t.id is null or work.row_level('work.task', i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (authz.can('tasks.assign')
            or (authz.can('tasks.assign_own') and t.owner_id = me and work.can_edit_task(me, t))
            or (p_owner = me and work.can_edit_task(me, t) and t.owner_id is not null)) then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    -- the new owner must be able to see the task (its department, and a level on Tasks)
    if work.person_ok(p_owner) and not authz.can_see_as(p_owner, 'work.task', i) then
      raise exception using errcode = 'P0001', message = 'task.owner_cannot_see', detail = p_owner::text;
    end if;
  end loop;
  req := audit.begin('ui', 'task.assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  perform work.quiet_if_past(p_ids);
  for t in select * from work.task x where x.id = any (p_ids) and x.owner_id is distinct from p_owner loop
    update work.task set owner_id = p_owner, assigned_by = case when p_owner <> me then me end where id = t.id;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_owner, 'assigned', 'work.task', t.id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;
