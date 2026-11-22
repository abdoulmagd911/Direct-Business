-- Landing 33 (B4) — a step done is a dated record, and it feeds the achievement's evidence: the achievement that came
-- from a task shows that task's done steps (what, which day, who). Nothing is copied; the read follows the task.
-- Forward-only: perf.achievement_get made again with one more key.

create or replace function perf.achievement_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  a perf.achievement;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from perf.achievement where id = p_id and deleted_at is null;
  if a.id is null or perf.row_level('perf.achievement', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return perf.achievement_row(a, me) || pg_catalog.jsonb_build_object(
    'notes', a.notes, 'before_value', a.before_value, 'after_value', a.after_value, 'created_by', a.created_by,
    'moved_from', a.period_moved_from, 'move_reason', a.period_move_reason, 'moved_by', a.period_moved_by,
    'import_key', a.import_key,
    'refs', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value,
        'url', coalesce(r.url, pg_catalog.replace(s.url_template, '{value}', r.value)), 'version', r.version)
        order by r.created_at)
      from perf.achievement_ref r join work.ref_system s on s.id = r.system_id
      where r.achievement_id = p_id and r.deleted_at is null), '[]'::jsonb),
    -- Landing 33 (B4): the steps done on the task this achievement came from — what was done, on which day, by whom.
    -- Served only to a reader who may see that task.
    'source_task_steps', case when a.source_task_id is not null
                                   and work.row_level('work.task', a.source_task_id, me) >= 'view'
      then coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', i.id, 'text', i.text, 'done_on', i.done_on, 'done_by', i.done_by,
          'done_by_name', coalesce(pr.display_name_en, q.nickname_en, q.full_name_en),
          'done_by_name_ar', coalesce(pr.display_name_ar, q.nickname_ar, q.full_name_ar))
          order by i.done_on, i.sort, i.created_at)
        from work.action_item i
        left join core.person q on q.id = i.done_by
        left join core.person_profile pr on pr.person_id = i.done_by
        where i.task_id = a.source_task_id and i.deleted_at is null and i.done_on is not null), '[]'::jsonb)
      else '[]'::jsonb end,
    'participant_roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', x.id, 'person_id', x.person_id, 'role', x.role) order by x.created_at)
      from perf.achievement_participant x where x.achievement_id = p_id and x.deleted_at is null), '[]'::jsonb));
end
$$;
