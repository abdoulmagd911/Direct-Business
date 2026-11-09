-- Landing 3 (FIX-35, D5): the task ↔ achievement link, rendered. The write path already stores
-- source_task_id (ACH-12, WREV-02); what was missing was the read side. perf.achievement_row now
-- carries the task it came from (its number only when the reader may see the task), and work.task_row
-- carries the earliest live achievement logged from it (its number and title only when the reader may
-- see that achievement's department), so both records can link to each other. The achievement is the
-- earliest by logged day, then id — the first time the task was logged. Copied exactly otherwise
-- (achievement_row from 20261002040000, task_row from 20261107150000). Forward-only (V103).
create or replace function perf.achievement_row(a perf.achievement, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', a.id, 'number', a.number, 'plan_id', a.plan_id, 'year', p.year, 'department_id', a.department_id,
    'repeat_of', a.repeat_of, 'repeat_of_number', (select e.number from perf.achievement e where e.id = a.repeat_of),
    'mou_side', a.mou_side,
    'category', c.code, 'category_en', c.name_en, 'category_ar', c.name_ar, 'parent_category', pc.code,
    'has_deal_value', c.has_deal_value, 'title', a.title, 'count', a.count, 'deal_value', a.deal_value,
    'value_report_kind', a.value_report_kind, 'value_report_period', a.value_report_period,
    'partner_id', a.partner_id, 'owner_id', a.owner_id, 'happened_on', a.happened_on, 'logged_at', a.logged_at,
    'origin', a.origin, 'source_kind', a.source_kind, 'source_period', a.source_period,
    'source_task_id', a.source_task_id,
    'source_task_number', case when a.source_task_id is null then null
      when work.row_level('work.task', a.source_task_id, p_reader) >= 'view'
      then (select t.number from work.task t where t.id = a.source_task_id) end,
    'date_from_report', a.date_from_report, 'use_as_example', a.use_as_example, 'version', a.version,
    'line_en', perf.line_of(a.id, 'en'), 'line_ar', perf.line_of(a.id, 'ar'),
    'can_edit', perf.can_edit(p_reader, a),
    'participants', coalesce((select pg_catalog.jsonb_agg(x.person_id order by x.created_at, x.person_id)
                              from perf.achievement_participant x where x.achievement_id = a.id and x.deleted_at is null),
                             '[]'::jsonb)
  ) || perf.achievement_flags(a)
  from perf.plan p
  join perf.achievement_category c on c.id = a.category_id
  left join perf.achievement_category pc on pc.id = c.parent_id
  where p.id = a.plan_id
$$;

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
  where s.id = t.status_id
$$;
