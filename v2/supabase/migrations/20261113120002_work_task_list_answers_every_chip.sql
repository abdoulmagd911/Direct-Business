-- Owner 13 Nov (A-tasks): the Tasks list asked api.tasks for at most 200 rows and then judged Helping, the due chips
-- (Today, This week — the next seven days —, No date) and the priority chip on those rows in the browser. A view past
-- the first 200 rows lost tasks without saying so, and the "Showing the first {shown} of {total}" line counted the
-- unfiltered total. The door now answers every chip itself, so the rows and the total are the view's:
--   · scope 'helping': my work that someone else owns (work.in_my_work, not the owner);
--   · due 'today' | 'week' | 'none': Riyadh's today, today and the six days after (the chip's window, unchanged), or
--     no due day;
--   · the priority sort follows the settings list's own order (work.priority.sort), as the screen's own sort does
--     (FIX-01, D28) — a priority an admin adds sorts where the list puts it, not after Low.
-- The screen now also sends its sort (20261109000010 put the sort at the database for this reason; the screen never
-- sent it). Everything else is copied from 20261109000010_work_task_list_sort.sql exactly.
-- Forward-only: replaces work.task_list whole; api.tasks keeps calling it.
create or replace function work.task_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0)
returns jsonb
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
  due text := nullif(f ->> 'due', '');
  today date := core.riyadh_today();
  rows jsonb;
  total int;
begin
  with hits as (
    select t, work.task_flags(t) as fl, pr.meaning as directive, s.meaning,
           pr.key as priority_key,
           -- the settings list's own order; no priority after every prioritised task
           coalesce(pr.sort, 2147483647) as priority_rank,
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
            -- Helping: my work someone else owns
            when 'helping' then work.in_my_work(t, me) and t.owner_id is distinct from me
            else true end
      and case due
            when 'today' then t.due_on = today
            when 'week' then t.due_on between today and today + 6
            when 'none' then t.due_on is null
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
                                  -- tie-break the fix round agreed (D28): added-at, then id ('oldest' is that
                                  -- tie-break alone)
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
