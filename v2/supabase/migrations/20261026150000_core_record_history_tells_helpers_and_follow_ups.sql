-- B (the Architect's order of 26 Oct): a record's Activity tab also tells who was added or taken off as a task's helper,
-- and the reader's own follow-ups on the record.
--  1. A task's helpers live in their own rows (work.task_helper), so adding one never showed on the task. Their changes
--     now join the task's own: "Helper added: <name>", "Helper removed".
--  2. A follow-up is a private reminder about a record (V632 Stage 2: a my.note about it with its core.reminder). Its
--     reminder's changes join the record's history for the follow-up's author alone, never for anyone else (V454):
--     "Follow-up added", with its time.
-- Each change now says which kind of record it is ('entity'), so the timeline can name it. Everything else is as
-- 20260929062000 left audit.record_history: the record's own changes, the same read check. Forward-only (V103).
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
      -- the reader's own follow-ups on the record: their reminders, never anyone else's
      select a.id from audit.change a
      join core.reminder r on r.id = a.row_id
      join my.note n on n.id = r.note_id
      where a.table_name = 'core.reminder' and r.person_id = me
        and n.about_table = e.table_name and n.about_id = p_id)), '[]'::jsonb);
end
$$;
