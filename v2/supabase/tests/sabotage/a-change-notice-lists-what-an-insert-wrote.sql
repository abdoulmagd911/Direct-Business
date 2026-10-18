-- Sabotage: a-change-notice-lists-what-an-insert-wrote
-- Breaks: sql:NTF-08
-- Expect: a record someone added names no fields
-- A notice of an added record lists every column the insert wrote, its id and keys among them (before QA-577).
create or replace function notify.changed_fields(p_kind text, p_request uuid, p_table text, p_id uuid, p_person uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(distinct f), '[]'::jsonb)
  from audit.change c cross join lateral pg_catalog.unnest(c.fields) f
  where p_kind in ('changed_by_other', 'followed_change')
    and p_table is not null and authz.can_see_as(p_person, p_table, p_id)
    and c.request_id = p_request and c.table_name = p_table and c.row_id = p_id
    and f <> 'version' and f not like '%\_at' and f not like '%\_by'
$$;
