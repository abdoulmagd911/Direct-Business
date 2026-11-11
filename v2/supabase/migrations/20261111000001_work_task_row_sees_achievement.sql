-- Landing 13 (review security #2): the Tasks page showed a linked achievement's number and title to anyone
-- who could see the task, even when they could not see the achievement — work.task_row's lateral joined the
-- achievement on department visibility only (perf.sees_department), while the record's own rule is
-- perf.sees_achievement (department, and Full on KPIs, or one of its own people, or the owner's team). The
-- lateral now asks sees_achievement, so a reader who may not see the achievement gets no number or title
-- from the task. work.task_row is copied from 20261109000013, that one change, each exactly otherwise.
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
                       and perf.sees_achievement(p_reader, a)
                     order by a.logged_at, a.id limit 1) ach on true
  left join lateral (select n.body
                     from core.note n
                     where n.entity_table = 'work.task' and n.entity_id = t.id
                       and n.kind = 'escalation' and n.deleted_at is null
                     order by n.created_at desc, n.id desc limit 1) esc on true
  where s.id = t.status_id
$$;
