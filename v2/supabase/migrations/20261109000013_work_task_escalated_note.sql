-- Landing 3 (FIX-26 F031): the flag note is readable. work.task_row carries the latest live escalation
-- note on the task, so the task page can show the note itself, not just the flag. And a record's history
-- now includes its timeline notes (core.note rows on the record): the audit already captures note inserts
-- (the capture trigger is on core.note), but audit.record_history only joined the record's own changes,
-- its helpers and the reader's follow-ups — the note the flag was raised with never reached History.
-- task_row is copied from 20261109000014, record_history from 20261026150000, each exactly otherwise.
-- Forward-only (V103).
create or replace function work.task_row(t work.task, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', t.id, 'number', t.number, 'title', t.title, 'owner_id', t.owner_id, 'team_id', t.team_id,
    'priority', pr.key, 'priority_en', pr.name_en, 'priority_ar', pr.name_ar, 'executive_directive', pr.meaning is not null,
    'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'meaning', s.meaning,
    'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar, 'work_type', t.work_type,
    'start_on', t.start_on, 'due_on', t.due_on, 'partner_id', t.partner_id, 'project_id', t.project_id,
    'origin', t.origin, 'happened_on', t.happened_on, 'logged_at', t.logged_at, 'closed_at', t.closed_at,
    'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'cancelled_reason', t.cancelled_reason, 'version', t.version,
    'starred', t.starred, 'dismissed_from_nudge', t.dismissed_from_nudge,
    'has_achievement', exists (select 1 from perf.achievement a
                               where a.source_task_id = t.id and a.deleted_at is null),
    'achievement_id', ach.id, 'achievement_number', ach.number, 'achievement_title', ach.title,
    'escalated', t.escalated, 'escalated_at', t.escalated_at, 'escalated_by', t.escalated_by,
    'escalated_to', t.escalated_to,
    'escalated_note', esc.body,
    'can_edit', work.can_edit_task(p_reader, t),
    'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                          where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
    'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                         from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
  ) || work.task_flags(t)
  from work.task_status s
  left join work.priority pr on pr.id = t.priority_id
  left join work.task_type ty on ty.id = t.type_id
  left join lateral (select a.id, a.number, a.title
                     from perf.achievement a
                     where a.source_task_id = t.id and a.deleted_at is null
                       and perf.sees_department(p_reader, a.department_id)
                     order by a.logged_at, a.id limit 1) ach on true
  left join lateral (select n.body
                     from core.note n
                     where n.entity_table = 'work.task' and n.entity_id = t.id
                       and n.kind = 'escalation' and n.deleted_at is null
                     order by n.created_at desc, n.id desc limit 1) esc on true
  where s.id = t.status_id
$$;

create or replace function audit.record_history(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'change_id', c.id, 'request_id', q.id, 'at', c.at, 'actor_id', q.actor_id, 'kind', q.kind,
             'label_key', q.label_key, 'label_args', q.label_args, 'reason', q.reason, 'action', c.action,
             'fields', c.fields, 'before', c.before, 'after', c.after, 'undone', q.undone_by is not null,
             'undo_of', q.undo_of, 'happened_on', q.happened_on,
             'entity', coalesce(x.key, c.table_name)) order by c.id desc)
    from audit.change c
    join audit.request q on q.id = c.request_id
    left join core.entity x on x.table_name = c.table_name
    where c.id in (
      -- the record's own changes
      select a.id from audit.change a where a.table_name = e.table_name and a.row_id = p_id
      union all
      -- a task's helpers, added and taken off
      select a.id from audit.change a join work.task_helper h on h.id = a.row_id
      where e.table_name = 'work.task' and a.table_name = 'work.task_helper' and h.task_id = p_id
      union all
      -- the record's timeline notes, added and changed — the flag note among them, with its text
      select a.id from audit.change a join core.note n on n.id = a.row_id
      where a.table_name = 'core.note' and n.entity_table = e.table_name and n.entity_id = p_id
      union all
      -- the reader's own follow-ups on the record: their reminders, never anyone else's
      select a.id from audit.change a
      join core.reminder r on r.id = a.row_id
      join my.note n on n.id = r.note_id
      where a.table_name = 'core.reminder' and r.person_id = me
        and n.about_table = e.table_name and n.about_id = p_id)), '[]'::jsonb);
end
$$;
