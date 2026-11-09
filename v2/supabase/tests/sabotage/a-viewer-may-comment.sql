-- Sabotage: a-viewer-may-comment
-- Breaks: sql:CMT-01
-- Expect: a viewer reads only: no comment
-- Anyone who sees a task may comment on it, not only those who hold Own or more on Tasks (P1a).
create or replace function work.can_comment(p_person uuid, t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select authz.can_see_as(p_person, 'work.task', t.id)
$$;
