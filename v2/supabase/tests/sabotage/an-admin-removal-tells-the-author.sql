-- Sabotage: an-admin-removal-tells-the-author
-- Breaks: sql:CMT-01
-- Expect: tell its author nothing twice
-- A comment's owner is its author again, so the generic change notice tells them of a removal and of its Undo.
create or replace function work.task_comment_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select c.created_by from work.task_comment c where c.id = p_id $$;
