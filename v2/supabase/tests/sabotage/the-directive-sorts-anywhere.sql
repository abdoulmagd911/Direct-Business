-- Sabotage: the-directive-sorts-anywhere
-- Breaks: sql:TSK-05
-- Expect: the Executive directive sorts first
-- An Executive directive sorts among the rest by its due day.
create or replace function work.task_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'view');
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := norm.fold(f ->> 'q');
  past boolean := coalesce((f ->> 'past_work')::boolean, false) or coalesce((f ->> 'needs_owner')::boolean, false);
  rows jsonb;
  total int;
begin
  with hits as (
    select t, work.task_flags(t) as fl, pr.meaning as directive, s.meaning
    from work.task t
    join work.task_status s on s.id = t.status_id
    left join work.priority pr on pr.id = t.priority_id
    where t.deleted_at is null and work.row_level('work.task', t.id, me) >= 'view'
      and work.task_is_past(t) = past
      and (not coalesce((f ->> 'needs_owner')::boolean, false) or t.owner_id is null)
      and case coalesce(f ->> 'scope', 'all')
            when 'mine' then t.owner_id = me
            when 'my_work' then work.in_my_work(t, me)
            else true end
      and (f -> 'meanings' is null or s.meaning in (select pg_catalog.jsonb_array_elements_text(f -> 'meanings')))
      and (nullif(f ->> 'owner_id', '') is null or t.owner_id = (f ->> 'owner_id')::uuid)
      and (nullif(f ->> 'partner_id', '') is null or t.partner_id = (f ->> 'partner_id')::uuid)
      and (nullif(f ->> 'project_id', '') is null or t.project_id = (f ->> 'project_id')::uuid)
      and (nullif(f ->> 'type', '') is null or t.type_id = work.list_id('work.task_type', f ->> 'type'))
      and (q is null or norm.fold(t.title) like '%' || q || '%' or norm.fold(t.number) like '%' || q || '%')
  ), flagged as (
    select * from hits
    where (not coalesce((f ->> 'overdue')::boolean, false) or (fl ->> 'overdue')::boolean)
      and (not coalesce((f ->> 'stale')::boolean, false) or (fl ->> 'stale')::boolean)
      and (not coalesce((f ->> 'blocked')::boolean, false) or (fl ->> 'blocked')::boolean)
  )
  select (select pg_catalog.count(*)::int from flagged),
         coalesce((select pg_catalog.jsonb_agg(work.task_row(x.t, me) order by x.o)
                   from (select y.t, pg_catalog.row_number() over (
                                  order by (y.meaning in ('done', 'cancelled')),
                                           (y.t).due_on nulls last, (y.t).number) o
                         from flagged y) x
                   where x.o > off and x.o <= off + lim), '[]'::jsonb)
    into total, rows;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > off + lim);
end
$$;
