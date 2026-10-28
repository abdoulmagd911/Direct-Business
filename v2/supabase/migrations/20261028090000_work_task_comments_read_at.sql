-- Task comments: the list says when it was read (the live test of 27 Oct: after Undo the screen showed an older read of
-- the list than the one the database held). The screen keeps the newest read it has seen, whichever way it came (the
-- page's own re-read, or the read it makes right after a write), so a late, older read can never put it back.
-- work.task_comments as 20261027090000 wrote it, plus `read_at`. Forward-only (V103).
create or replace function work.task_comments(p_task uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_for_comments(p_task, false);
begin
  return pg_catalog.jsonb_build_object(
    'read_at', pg_catalog.clock_timestamp(),
    'can_write', work.can_comment(me, t),
    'comments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', c.id, 'body', c.body, 'author_id', c.created_by, 'created_at', c.created_at,
        'edited_at', c.edited_at, 'version', c.version, 'mine', c.created_by = me,
        'can_edit', c.created_by = me and work.can_comment(me, t),
        'can_remove', c.created_by = me or authz.is_admin())
        order by c.created_at, c.seq)
      from work.task_comment c where c.task_id = p_task and c.deleted_at is null), '[]'::jsonb));
end
$$;
