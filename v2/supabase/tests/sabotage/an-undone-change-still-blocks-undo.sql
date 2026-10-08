-- Sabotage: an-undone-change-still-blocks-undo
-- Breaks: sql:UNDO-07
-- Expect: a rename taken back no longer blocks undoing the add: the value is gone
-- A later change that was itself undone still blocks Undo, as before the fix (A16).
create or replace function audit.changed_since(p_table text, p_id uuid, p_after bigint, p_field text, p_not_requests uuid[])
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('entity', p_table, 'id', p_id, 'field', p_field, 'by', q.actor_id, 'at', c.at)
  from audit.change c join audit.request q on q.id = c.request_id
  where c.table_name = p_table and c.row_id = p_id and c.id > p_after and not (c.request_id = any (p_not_requests))
    and (p_field is null or p_field = any (c.fields))
  order by c.id desc
  limit 1
$$;
