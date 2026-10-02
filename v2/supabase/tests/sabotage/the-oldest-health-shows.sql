-- Sabotage: the-oldest-health-shows
-- Breaks: sql:PRJ-01
-- Expect: the latest update is the chip
-- The first health update stays the chip.
create or replace function work.project_row(p work.project, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', p.id, 'number', p.number, 'name', p.name, 'description', p.description, 'work_type', p.work_type,
    'partner_id', p.partner_id, 'owner_id', p.owner_id, 'department_id', p.department_id,
    'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'category', s.category,
    'start_on', p.start_on, 'due_on', p.due_on, 'closed_at', p.closed_at, 'segment_id', p.segment_id,
    'happened_on', p.happened_on, 'version', p.version,
    'health', (select pg_catalog.jsonb_build_object('health', h.health, 'line', h.line, 'happened_on', h.happened_on,
                                                    'by', h.created_by)
               from work.project_health h where h.project_id = p.id and h.deleted_at is null
               order by h.happened_on, h.logged_at limit 1),
    'open_tasks', (select pg_catalog.count(*)::int from work.task t join work.task_status ts on ts.id = t.status_id
                   where t.project_id = p.id and t.deleted_at is null and ts.meaning not in ('done', 'cancelled')))
  from work.project_status s where s.id = p.status_id
$$;
