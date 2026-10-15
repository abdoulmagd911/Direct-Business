-- Sabotage: a-change-notice-tells-anyone-what-changed
-- Breaks: sql:NTF-05
-- Expect: neither its name nor what changed
-- What a change notice says changed reaches a reader who may no longer see the record (QA-553's rule, on the fields).
create or replace function notify.changed_fields(p_kind text, p_request uuid, p_table text, p_id uuid, p_person uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(distinct f), '[]'::jsonb)
  from audit.change c cross join lateral pg_catalog.unnest(c.fields) f
  where p_kind in ('changed_by_other', 'followed_change')
    and c.request_id = p_request and c.table_name = p_table and c.row_id = p_id
    and f <> 'version' and f not like '%\_at' and f not like '%\_by'
$$;
