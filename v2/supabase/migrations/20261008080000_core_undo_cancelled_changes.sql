-- Undo looks past changes that cancelled out (found on #186's hand-entry round). Undo refuses a request when a later
-- change touched the same row or field (A16). A later request that was itself undone, and the undo that took it back,
-- leave the row as the request left it — so they no longer block it: add a row, edit it, undo the edit, and the add can
-- be undone. A later change still in force blocks as before; one that was undone and then redone is in force again.
-- Forward-only.
create or replace function audit.changed_since(p_table text, p_id uuid, p_after bigint, p_field text, p_not_requests uuid[])
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('entity', p_table, 'id', p_id, 'field', p_field, 'by', q.actor_id, 'at', c.at)
  from audit.change c join audit.request q on q.id = c.request_id
  where c.table_name = p_table and c.row_id = p_id and c.id > p_after and not (c.request_id = any (p_not_requests))
    and (p_field is null or p_field = any (c.fields))
    -- a request taken back, and the undo that took it back, cancel out
    and q.undone_by is null
    and not (q.kind = 'undo' and exists (select 1 from audit.request t where t.id = q.undo_of and t.undone_by = q.id))
  order by c.id desc
  limit 1
$$;
