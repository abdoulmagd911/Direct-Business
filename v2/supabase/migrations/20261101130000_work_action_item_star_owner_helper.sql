-- Checklist stars, owner decision 1 Nov 2026: a checklist line may be starred by
-- whoever may tick it — the task's editors, the line's owner, or its helpers —
-- not by task editors only. The task's own star is unchanged (still editors only).
-- Forward-only (V103): no old migration is edited, and no new table, RPC, or
-- message key is added. The logging, Undo, and no-op behaviour of
-- work.action_item_star are unchanged; only its permission check widens.
--
-- work.task_get, with exactly one field added: the line's star, next to its
-- version, so the checklist screen reads it. The rest of the body is copied
-- unchanged from 20261002010000_work_projects_tasks.sql.
create or replace function work.task_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return work.task_row(t, me) || pg_catalog.jsonb_build_object(
    'notes', t.notes, 'assigned_by', t.assigned_by, 'closed_by', t.closed_by, 'created_by', t.created_by,
    'action_items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.id, 'text', a.text, 'owner_id', a.owner_id, 'due_on', a.due_on, 'done_on', a.done_on, 'done_by', a.done_by,
        'sort', a.sort, 'source_note_id', a.source_note_id, 'happened_on', a.happened_on, 'version', a.version,
        'starred', a.starred,
        'overdue', not work.task_is_past(t) and a.done_on is null and a.due_on < core.riyadh_today(),
        'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at)
                             from work.action_item_helper h where h.action_item_id = a.id and h.deleted_at is null),
                            '[]'::jsonb)) order by a.sort, a.created_at)
      from work.action_item a where a.task_id = p_id and a.deleted_at is null), '[]'::jsonb),
    'refs', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value) order by r.created_at)
      from work.task_ref r join work.ref_system s on s.id = r.system_id
      where r.task_id = p_id and r.deleted_at is null), '[]'::jsonb),
    'contacts', coalesce((select pg_catalog.jsonb_agg(c.contact_id order by c.created_at)
      from work.task_contact c where c.task_id = p_id and c.deleted_at is null), '[]'::jsonb),
    'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'from', f.key, 'to', s.key, 'meaning', s.meaning, 'blocked', c.blocked, 'reason', c.reason,
        'happened_on', c.happened_on, 'logged_at', c.logged_at, 'by', c.created_by)
        order by c.happened_on desc, c.logged_at desc)
      from work.task_status_change c join work.task_status s on s.id = c.to_status_id
      left join work.task_status f on f.id = c.from_status_id
      where c.task_id = p_id and c.deleted_at is null), '[]'::jsonb));
end
$$;

-- Star or unstar a task's checklist item: whoever may tick it (the same group
-- as canTick in src/modules/tasks/rules.ts) — a task editor, the line's owner,
-- or one of its helpers. Someone who may not even see the task still gets
-- 'not found', and someone who may see it but may not tick it still gets the
-- needs-level refusal, exactly as work.task_editable refused before.
create or replace function work.action_item_star(p_id uuid, p_starred boolean) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a work.action_item;
  t work.task;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from work.action_item where id = p_id and deleted_at is null;
  if a.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into t from work.task where id = a.task_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', t.id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (work.can_edit_task(me, t) or a.owner_id = me
          or exists (select 1 from work.action_item_helper h
                     where h.action_item_id = a.id and h.person_id = me and h.deleted_at is null)) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  if p_starred is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  if a.starred = p_starred then
    return pg_catalog.jsonb_build_object('id', a.id, 'request_id', null, 'starred', a.starred, 'version', a.version);
  end if;
  req := audit.begin('ui', case when p_starred then 'action_item.starred' else 'action_item.unstarred' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  update work.action_item set starred = p_starred where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'starred', p_starred,
                                       'version', (select x.version from work.action_item x where x.id = p_id));
end
$$;
