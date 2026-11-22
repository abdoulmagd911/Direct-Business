-- Sabotage: a-hand-over-leaves-no-history
-- Breaks: sql:DLG-01
-- Expect: one hand-over is kept
-- The task keeps no record of who had it.
create or replace function work.task_handovers(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'at', r.at, 'happened_on', r.happened_on, 'by', r.actor_id,
           'from', c.before ->> 'owner_id', 'to', c.after ->> 'owner_id', 'reason', r.reason)
           order by c.id desc), '[]'::jsonb)
  from audit.change c join audit.request r on r.id = c.request_id
  where c.table_name = 'work.task' and c.row_id = p_id and c.action = 'update'
    and false
$$;
