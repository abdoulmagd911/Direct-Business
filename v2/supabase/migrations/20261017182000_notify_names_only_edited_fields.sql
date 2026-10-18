-- QA-577 (QA 2, 17 Oct): the bell read "<who> changed id, person id, auth user id, providers … on <record>". A notice
-- of a row someone ADDED (a person's new e-mail or sign-in record, a task's status-history row) listed every column the
-- insert wrote, the keys among them, and the screen could only turn those names into words as best it could. What
-- changed on a record is an edit: the fields of an update, never of an insert or a removal, and never the row's own id.
-- On production the edits named role, sign-in, status and team alone, all of which the screen has words for.
-- notify.changed_fields is replaced whole, as 20261014231000 left it, but for its action and id. Forward-only (V103).

create or replace function notify.changed_fields(p_kind text, p_request uuid, p_table text, p_id uuid, p_person uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(distinct f), '[]'::jsonb)
  from audit.change c cross join lateral pg_catalog.unnest(c.fields) f
  where p_kind in ('changed_by_other', 'followed_change')
    and p_table is not null and authz.can_see_as(p_person, p_table, p_id)
    and c.request_id = p_request and c.table_name = p_table and c.row_id = p_id and c.action = 'update'
    and f not in ('id', 'version') and f not like '%\_at' and f not like '%\_by'
$$;
