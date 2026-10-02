-- Mutant m26-ntf-system-told: what the system or a job wrote tells owners and followers
CREATE OR REPLACE FUNCTION notify.fan_out(p_request uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  q audit.request;
  n int;
begin
  select * into q from audit.request where id = p_request;
  if q.id is null or q.happened_on < core.riyadh_today() then
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
  where x.person_id <> q.actor_id and notify.may_notify(x.person_id, x.kind)
    and authz.can_see_as(x.person_id, x.table_name, x.row_id)
    and not exists (select 1 from notify.notification m where m.request_id = q.id and m.person_id = x.person_id)
  order by x.person_id, x.pri, x.id;
  get diagnostics n = row_count;
  return n;
end
$function$
;
