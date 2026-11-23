-- Sabotage: allowed-changes-nothing-of-a-teammates
-- Breaks: sql:XTR-03
-- Expect: Allowed: they can change a teammate's task
-- The task rule forgets the extra "Edit someone else's work": at Own, a person changes only what they own or made.
create or replace function work.can_edit_task(p_person uuid, t work.task) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select case work.row_level('work.task', t.id, p_person)
               when 'full' then true
               when 'own' then p_person = t.owner_id or p_person = t.created_by
               else false end
  );
end
$fn$;
