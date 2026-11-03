-- Rocky, 3 Nov 2026: removing a task, test tasks only. Modeled on perf.achievements_remove:
-- the reason is required, the task, its checklist rows and its helper links are soft-deleted
-- with the same reason, and audit + request_id let the UI toast offer Undo. The server
-- refuses anything that is not a test task (owner or creator marked TEST in
-- core.person.is_test) and anything the caller may not edit, so the screen's gate is a
-- convenience, never the guard. The go-live wipe (core.test_users_remove) is not used
-- here: it also deactivates the TEST users, who must stay while testing continues.
create function work.tasks_remove(p_ids uuid[], p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  i uuid;
  t work.task;
  req uuid;
  k int;
  test_owned boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  foreach i in array p_ids loop
    select * into t from work.task where id = i and deleted_at is null;
    if t.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not work.can_edit_task(me, t) then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
    end if;
    select exists (select 1 from core.person p
                   where p.id in (t.owner_id, t.created_by) and p.is_test)
      into test_owned;
    if not coalesce(test_owned, false) then
      raise exception using errcode = 'P0001', message = 'task.remove_not_test';
    end if;
  end loop;
  req := audit.begin('ui', 'task.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     pg_catalog.btrim(p_reason));
  update work.action_item set deleted_at = core.clock(), deleted_by = me, delete_reason = pg_catalog.btrim(p_reason)
    where task_id = any (p_ids) and deleted_at is null;
  update work.task_helper set deleted_at = core.clock(), deleted_by = me, delete_reason = pg_catalog.btrim(p_reason)
    where task_id = any (p_ids) and deleted_at is null;
  update work.task set deleted_at = core.clock(), deleted_by = me, delete_reason = pg_catalog.btrim(p_reason)
    where id = any (p_ids) and deleted_at is null;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

create function api.tasks_remove(p_ids uuid[], p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.tasks_remove(p_ids, p_reason) $$;

grant execute on function api.tasks_remove(uuid[], text) to authenticated;
