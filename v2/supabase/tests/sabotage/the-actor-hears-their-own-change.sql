-- Sabotage: the-actor-hears-their-own-change
-- Breaks: sql:NTF-01
-- Expect: an owner's own change tells only the follower
-- The fan-out forgets to leave out the one who made the change.
create or replace function notify.fan_out(p_request uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  q audit.request;
  n int;
begin
  select * into q from audit.request where id = p_request;
  if q.id is null or q.kind not in ('ui', 'undo') then
    return 0;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  select distinct on (x.person_id) x.person_id, x.kind, x.table_name, x.row_id, q.id, q.actor_id, q.label_key,
         q.label_args
  from (
    select o.person_id, 'changed_by_other' as kind, c.table_name, c.row_id, c.id, 0 as pri
    from audit.change c cross join lateral pg_catalog.unnest(core.owners_of(c.table_name, c.row_id)) o(person_id)
    where c.request_id = q.id
    union all
    select f.person_id, 'followed_change', c.table_name, c.row_id, c.id, 1
    from audit.change c join notify.follow f on f.entity_table = c.table_name and f.entity_id = c.row_id
    where c.request_id = q.id
  ) x
  where notify.may_notify(x.person_id, x.kind)
  order by x.person_id, x.pri, x.id;
  get diagnostics n = row_count;
  return n;
end
$$;
