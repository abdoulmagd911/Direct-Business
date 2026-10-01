-- Sabotage: my-work-forgets-the-helpers
-- Breaks: sql:TSK-03
-- Expect: a helper's work
-- My work leaves out the tasks I help on.
create or replace function work.in_my_work(t work.task, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select t.owner_id = p_person
      or exists (select 1 from work.action_item a where a.task_id = t.id and a.deleted_at is null and a.owner_id = p_person)
      or exists (select 1 from work.action_item a join work.action_item_helper h on h.action_item_id = a.id
                 where a.task_id = t.id and a.deleted_at is null and h.deleted_at is null and h.person_id = p_person)
$$;
