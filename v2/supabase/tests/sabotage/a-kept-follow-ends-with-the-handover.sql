-- Sabotage: a-kept-follow-ends-with-the-handover
-- Breaks: sql:HAND-01
-- Expect: following it themselves keeps it
-- A person who follows the record themselves loses it when the hand-over follow ends (V488).
create or replace function notify.follow_set(p_entity text, p_id uuid, p_on boolean) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  if p_on then
    insert into notify.follow (person_id, entity_table, entity_id) values (me, e.table_name, p_id)
    on conflict do nothing;
  else
    delete from notify.follow where person_id = me and entity_table = e.table_name and entity_id = p_id;
  end if;
  return p_on;
end
$$;
