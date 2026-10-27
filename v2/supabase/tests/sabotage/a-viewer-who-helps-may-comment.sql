-- Sabotage: a-viewer-who-helps-may-comment
-- Breaks: sql:CMT-01
-- Expect: a viewer who helps reads only
-- A helper may comment whatever their level on Tasks.
create or replace function work.can_comment(p_person uuid, t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select authz.can_see_as(p_person, 'work.task', t.id)
         and (work.can_edit_task(p_person, t)
              or (exists (select 1 from work.task_helper h
                              where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null)))
$$;
