-- Sabotage: a-tasks-event-reaches-everyone
-- Breaks: sql:LINK-05
-- Expect: the client's timeline gives them no event for it
-- A task's event on the client's timeline, with its title, reaches every reader of the client, past the task's own access (QA-553).
create or replace function core.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_limit int default 50,
                                      p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'body', n.body, 'happened_on', n.happened_on, 'logged_at', n.logged_at,
      'logged_late', core.logged_late(n.happened_on, n.logged_at),
      'type', t.key, 'type_en', t.name_en, 'type_ar', t.name_ar,
      'outcome', o.key, 'outcome_en', o.name_en, 'outcome_ar', o.name_ar, 'meaning', o.meaning,
      'next_step', n.next_step, 'next_step_on', n.next_step_on, 'next_step_task_id', n.next_step_task_id,
      'author_id', n.created_by, 'edited_at', n.edited_at, 'version', n.version, 'mine', n.created_by = me,
      'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                            from core.mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
      'from_note', my.from_note('core.note', n.id, me),
      -- an event the system wrote (D5): its type and values, worded by the screen in Arabic and English
      'event', case when n.event_type is null then null
                    else pg_catalog.jsonb_build_object('type', n.event_type, 'values',
                           (select pg_catalog.jsonb_build_object('task_id', t.id, 'number', t.number, 'title', t.title)
                            from work.task t where t.id = n.event_task_id)) end)
      order by n.happened_on desc, n.logged_at desc, n.id)
    from (select * from core.note x
          where x.entity_table = e.table_name and x.entity_id = p_id and x.deleted_at is null
            and (p_kinds is null or x.kind = any (p_kinds))
            -- a task's event reaches only those who may see the task (QA-553)

          order by x.happened_on desc, x.logged_at desc, x.id
          limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) n
    left join partner.activity_type t on t.id = n.activity_type_id
    left join partner.activity_outcome o on o.id = n.outcome_id), '[]'::jsonb);
end
$$;
