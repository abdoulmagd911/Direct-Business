-- Rocky, 4 Nov 2026: Batch A orphan fix. work.test_tasks_remove soft-deleted the
-- task, its checklist rows and its helper links, but not the reminders of its
-- follow-up notes, so a removed test task's reminder kept appearing on My day
-- (Batch A leftover: TEST Member reminder for 5 Nov 2026 09:00 on removed
-- TSK-2026-0053). This replaces the function only — same signature, same guard,
-- same audit request — adding the linked-reminder soft-delete. The api wrapper
-- and its grant are unchanged. Forward-only: the 3 Nov migration is not edited.
create or replace function work.test_tasks_remove(p_ids uuid[], p_reason text) returns jsonb
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
  -- Batch A orphan, 4 Nov 2026: a task follow-up is a private note about the task
  -- (my.note.about_table = 'work.task') with its reminder on core.reminder.note_id.
  -- Removing the task left the reminder firing for a task that no longer exists,
  -- so the reminder goes with the task, same reason, same audit request (Undo
  -- restores it with the rest, since core.reminder is audit-tracked). The note
  -- itself stays: it is the user's own text, and its about-display handles a
  -- removed task.
  update core.reminder set deleted_at = core.clock(), deleted_by = me, delete_reason = pg_catalog.btrim(p_reason)
    where note_id in (select id from my.note where about_table = 'work.task' and about_id = any (p_ids) and deleted_at is null)
    and deleted_at is null;
  update work.task set deleted_at = core.clock(), deleted_by = me, delete_reason = pg_catalog.btrim(p_reason)
    where id = any (p_ids) and deleted_at is null;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;
