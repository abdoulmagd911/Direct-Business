-- Sabotage: a-client-task-tells-twice
-- Breaks: sql:LINK-04
-- Expect: the new owner is told once
-- A task given on a client tells its new owner twice: once for the task and once more for the client link.
create or replace function work.task_client_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.partner_id is null or new.deleted_at is not null or work.task_is_past(new) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform notify.push_assigned(new.owner_id, 'assigned', 'work.task', new.id);
    insert into core.note (entity_table, entity_id, kind, event_type, event_task_id, created_by)
    values ('partner.partner', new.partner_id, 'update', 'task_added',
            new.id,
            coalesce(authz.me(), new.created_by));
  elsif old.closed_at is null and new.closed_at is not null then
    insert into core.note (entity_table, entity_id, kind, event_type, event_task_id, created_by)
    values ('partner.partner', new.partner_id, 'update', 'task_done',
            new.id,
            coalesce(authz.me(), new.closed_by, new.created_by));
  end if;
  return null;
end
$$;
