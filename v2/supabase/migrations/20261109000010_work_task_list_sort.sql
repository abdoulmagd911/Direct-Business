-- Landing 3 (FIX-01): the task list sorts and filters by priority. work.task_list gains a 'sort' filter key —
-- 'due' (the order as it was: flagged first, then due day, then number), 'newest', 'title', 'owner',
-- 'priority' (executive directive first, then high, medium, low, none) — and a 'priority' filter key (the
-- priority's key: high, medium, low, executive_directive). Every order ends in the stable tie-break the
-- fix round agreed (D28): added-at, then id. The sort is at the database, because the list reads 200 rows
-- while the total can exceed that. Copied from 20261107150000 exactly otherwise. Forward-only (V103).
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
  sort text := coalesce(nullif(f ->> 'sort', ''), 'due');
  rows jsonb;
  total int;
begin
  with hits as (
    select t, work.task_flags(t) as fl, pr.meaning as directive, s.meaning,
           pr.key as priority_key,
           case pr.key when 'executive_directive' then 0 when 'high' then 1 when 'medium' then 2
                       when 'low' then 3 else 4 end as priority_rank,
           (select coalesce(p.full_name_en, p.full_name_ar) from core.person p where p.id = t.owner_id) as owner_name
    from work.task t
    join work.task_status s on s.id = t.status_id
    left join work.priority pr on pr.id = t.priority_id
    where t.deleted_at is null and work.row_level('work.task', t.id, me) >= 'view'
      and work.task_is_past(t) = past
      and (not coalesce((f ->> 'needs_owner')::boolean, false) or t.owner_id is null)
      and (not coalesce((f ->> 'escalated')::boolean, false) or t.escalated)
      and (not coalesce((f ->> 'starred')::boolean, false) or t.starred)
      and case coalesce(f ->> 'scope', 'all')
            when 'mine' then t.owner_id = me
            when 'my_work' then work.in_my_work(t, me)
            else true end
      and (f -> 'meanings' is null or s.meaning in (select pg_catalog.jsonb_array_elements_text(f -> 'meanings')))
      and (nullif(f ->> 'owner_id', '') is null or t.owner_id = (f ->> 'owner_id')::uuid)
      and (nullif(f ->> 'partner_id', '') is null or t.partner_id = (f ->> 'partner_id')::uuid)
      and (nullif(f ->> 'project_id', '') is null or t.project_id = (f ->> 'project_id')::uuid)
      and (nullif(f ->> 'priority', '') is null or pr.key = f ->> 'priority')
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
                                  -- each sort names its own keys; the branches that do not apply are null
                                  -- for every row, so they never order. Every order ends in the stable
                                  -- tie-break the fix round agreed (D28): added-at, then id
                                  order by case when sort = 'newest' then (y.t).created_at end desc nulls last,
                                           case when sort = 'title' then pg_catalog.lower((y.t).title) end asc nulls last,
                                           case when sort = 'owner' then y.owner_name end asc nulls last,
                                           case when sort = 'priority' then y.priority_rank end asc nulls last,
                                           case when sort = 'due' then
                                             (case when coalesce((f ->> 'escalated')::boolean, false)
                                                   then (y.t).escalated_at end) end desc nulls last,
                                           case when sort = 'due' then (y.directive is not null) end desc,
                                           case when sort = 'due' then (y.meaning in ('done', 'cancelled')) end asc,
                                           case when sort = 'due' then (y.t).due_on end asc nulls last,
                                           case when sort = 'due' then (y.t).number end asc,
                                           case when sort = 'newest' then (y.t).id end desc,
                                           (y.t).created_at, (y.t).id) o
                         from flagged y) x
                   where x.o > off and x.o <= off + lim), '[]'::jsonb)
    into total, rows;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > off + lim);
end
$$;
