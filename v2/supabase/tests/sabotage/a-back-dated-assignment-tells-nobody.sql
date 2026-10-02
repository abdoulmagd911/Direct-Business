-- Sabotage: a-back-dated-assignment-tells-nobody
-- Breaks: sql:DATE-02
-- Expect: back-dated, the owner and the helper are still told
-- A task given with a past date tells nobody, as other past-dated changes (V456).
create or replace function notify.push_assigned(p_person uuid, p_kind text, p_table text, p_id uuid, p_label_args jsonb default null)
  returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  q audit.request;
begin
  select * into q from audit.request where id = r;
  if p_person is null or q.id is null or p_person = q.actor_id or not notify.may_notify(p_person, p_kind)
     or not authz.can_see_as(p_person, p_table, p_id) or q.happened_on < core.riyadh_today() then
    return false;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  values (p_person, p_kind, p_table, p_id, r, q.actor_id, 'notify.' || p_kind, p_label_args);
  return true;
end
$$;
