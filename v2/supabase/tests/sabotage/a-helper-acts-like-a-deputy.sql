-- Sabotage: a-helper-acts-like-a-deputy
-- Breaks: sql:DLG-02
-- Expect: a helper is not offered the status
-- Every helper counts as the deputy.
create or replace function work.is_deputy(p_person uuid, p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from work.task_helper h
                 where h.task_id = p_task and h.person_id = p_person and h.deleted_at is null)
$$;
