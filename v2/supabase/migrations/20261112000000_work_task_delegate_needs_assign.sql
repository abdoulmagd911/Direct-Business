-- Landing 14 · FIX-42(b): a Member-owner may not delegate (HELD pending the owner's access decision).
-- work.task_delegate as 20261109000021 (5) wrote it, with one new check: the caller needs `tasks.assign`. Before,
-- the owner change inside (work.tasks_assign) also let `tasks.assign_own` through for a task of one's own, so a
-- Member-owner could delegate. work.tasks_assign itself is unchanged: the Owner picker in Details keeps its rule.
-- Forward-only (V103).

create or replace function work.task_delegate(p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  note jsonb;
  req uuid;
begin
  if nullif(pg_catalog.btrim(p_note), '') is null then
    raise exception using errcode = 'P0001', message = 'task.delegate_note_required';
  end if;
  -- FIX-42(b): delegating is for whoever gives work. A Member-owner (`tasks.assign_own` only) delegating their own task
  -- is HELD pending the owner's access decision, so the ⋯ menu no longer offers it and the door refuses it too.
  if not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  if p_to is null or not work.person_ok(p_to) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_to::text;
  end if;
  if p_to = me then
    raise exception using errcode = 'P0001', message = 'task.delegate_to_yourself';
  end if;
  if not authz.can_see_as(p_to, 'work.task', p_id) then
    raise exception using errcode = 'P0001', message = 'task.delegate_cannot_see', detail = p_to::text;
  end if;
  req := audit.begin('ui', 'task.delegated', pg_catalog.jsonb_build_object('number', t.number));
  perform work.tasks_assign(array[p_id], p_to, p_note);
  note := core.note_add('task', p_id, 'update', p_note);
  insert into notify.follow (person_id, entity_table, entity_id) values (me, 'work.task', p_id)
    on conflict do nothing;
  if not exists (select 1 from work.task_helper h
                 where h.task_id = p_id and h.person_id = me and h.deleted_at is null) then
    insert into work.task_helper (task_id, person_id) values (p_id, me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'note_id', note ->> 'id', 'owner_id', p_to);
end
$$;
comment on function work.task_delegate(uuid, uuid, text) is
  'Phase 1: delegate a task (tasks.assign only — FIX-42(b)) — owner change via work.tasks_assign, note via core.note_add, delegator follows and is listed as a helper (FIX-40).';
