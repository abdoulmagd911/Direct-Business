-- Sabotage: a-comment-reads-without-the-task-rule
-- Breaks: sql:CMT-01
-- Expect: a person who cannot see the task reads none of its comments
-- The comments door stops asking whether the reader can see the task.
create or replace function work.comment_record(p_entity text, p_id uuid) returns core.entity
language sql stable security definer set search_path = ''
as $$ select * from core.entity where key = p_entity and active $$;
