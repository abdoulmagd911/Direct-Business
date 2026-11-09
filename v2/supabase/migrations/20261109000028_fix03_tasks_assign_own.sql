-- FIX-03 (F244/F020, P1b): a Member may delegate their OWN task. work.tasks_assign gave work to someone else only
-- with the tasks.assign capability (head/manager), so a Member could not hand over a task they owned — the Delegate
-- dialog and the Owner picker both refused. The new capability tasks.assign_own (member by default, registry sync)
-- lets the task's owner, who may edit it, give it to someone else; anything else still needs tasks.assign, and
-- giving a task to oneself keeps its existing rule (owner or creator, task already owned). task_delegate calls
-- tasks_assign, so the Delegate dialog follows the same rule. Rebased 9 Nov 2026 onto Landing 3's 20261109000021:
-- this migration touches tasks_assign only — task_create's own-task door (naming another owner at creation with
-- tasks.assign_own) is Landing 3's, and stays. Forward-only (V103).
-- Regression tests: TSK-01 (member legs), DLG-01 (member delegates their own task).
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
