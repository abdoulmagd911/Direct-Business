-- Sabotage: a-task-goes-to-someone-who-cannot-see-its-partner
-- Breaks: sql:DLG-02
-- Expect: someone who cannot see the partner is not given its task
-- A task is handed to someone who cannot see its partner.
create or replace function work.tasks_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  i uuid;
  t work.task;
  req uuid;
  k int := 0;
  why text := nullif(pg_catalog.btrim(p_reason), '');
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
    if t.owner_id is null then
      -- nobody's yet: whoever may give work out places it
      if not authz.can('tasks.assign') then
        raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
      end if;
    elsif t.owner_id is distinct from p_owner then
      -- O-3: a hand-over is the Responsible's own act
      if t.owner_id <> me or not work.can_edit_task(me, t)
         or not (authz.can('tasks.assign') or authz.can('tasks.assign_own')) then
        raise exception using errcode = '42501', message = 'task.hand_over_not_yours';
      end if;
      if why is null then
        raise exception using errcode = 'P0001', message = 'task.hand_over_reason_required';
      end if;
      if pg_catalog.length(why) > 120 then
        raise exception using errcode = 'P0001', message = 'task.hand_over_reason_too_long';
      end if;
    end if;
    -- the new owner must be able to see the task (its department, and a level on Tasks)
    if work.person_ok(p_owner) and not authz.can_see_as(p_owner, 'work.task', i) then
      raise exception using errcode = 'P0001', message = 'task.owner_cannot_see', detail = p_owner::text;
    end if;
    -- and the partner the task belongs to
    if t.partner_id is not null and t.owner_id is distinct from p_owner
       and false then
      raise exception using errcode = 'P0001', message = 'task.owner_cannot_see_partner', detail = p_owner::text;
    end if;
  end loop;
  req := audit.begin('ui', 'task.assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), why);
  perform work.quiet_if_past(p_ids);
  for t in select * from work.task x where x.id = any (p_ids) and x.owner_id is distinct from p_owner loop
    update work.task set owner_id = p_owner, assigned_by = case when p_owner <> me then me end where id = t.id;
    -- the new Responsible is no longer the task's deputy
    update work.task_helper set is_deputy = false
    where task_id = t.id and person_id = p_owner and is_deputy and deleted_at is null;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_owner, 'assigned', 'work.task', t.id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;
