-- Sabotage: a-yearly-review-forgets-last-years-files
-- Breaks: sql:TPL-01
-- Expect: with last year's files linked
-- attach_previous links nothing (V479).
create or replace function work.template_attach_previous(t work.task_template, p_partner uuid, p_task uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  prev uuid;
  n int;
begin
  return 0;
  select o.task_id into prev from work.task_occurrence o
  where o.template_id = t.id and o.partner_id is not distinct from p_partner and o.task_id is not null
    and o.task_id <> p_task and o.deleted_at is null
  order by o.occurs_on desc limit 1;
  if prev is null then
    return 0;
  end if;
  insert into core.file_link (file_id, entity_table, entity_id, purpose)
  select l.file_id, 'work.task', p_task, l.purpose from core.file_link l
  where l.entity_table = 'work.task' and l.entity_id = prev and l.deleted_at is null;
  get diagnostics n = row_count;
  return n;
end
$$;
