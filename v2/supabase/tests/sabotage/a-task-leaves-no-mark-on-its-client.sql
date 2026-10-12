-- Sabotage: a-task-leaves-no-mark-on-its-client
-- Breaks: sql:LINK-03
-- Expect: adding it writes an event on the client's timeline
-- A task on a client writes nothing on the client's timeline, so its page keeps saying nothing happened (D5).
create or replace function work.task_client_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if true or new.partner_id is null or new.deleted_at is not null or work.task_is_past(new) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into core.note (entity_table, entity_id, kind, body, created_by)
    values ('partner.partner', new.partner_id, 'update', pg_catalog.format('Task %s added: %s', new.number, new.title),
            coalesce(authz.me(), new.created_by));
  elsif old.closed_at is null and new.closed_at is not null then
    insert into core.note (entity_table, entity_id, kind, body, created_by)
    values ('partner.partner', new.partner_id, 'update', pg_catalog.format('Task %s done: %s', new.number, new.title),
            coalesce(authz.me(), new.closed_by, new.created_by));
  end if;
  return null;
end
$$;
