-- Sabotage: a-comment-reads-without-the-task-rule
-- Breaks: sql:CMT-01
-- Expect: a person who cannot see the task reads none of its comments
-- The comments door stops asking whether the reader can see the task.
create or replace function work.task_for_comments(p_task uuid, p_write boolean) returns work.task
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_task and deleted_at is null;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if false then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'view')::text;
  end if;
  if p_write and not work.can_comment(me, t) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  return t;
end
$$;
