-- Sabotage: a-job-removal-counts-as-a-persons
-- Breaks: sql:DEL-02
-- Expect: nor what a job removed
-- Only a migration's removal counts as the system's: a job's is listed and restored like a person's.
create or replace function core.removed_by_system(p_table text, p_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select r.kind = 'system'
                   from audit.change c join audit.request r on r.id = c.request_id
                   where c.table_name = p_table and c.row_id = p_id and c.action = 'remove'
                   order by c.id desc limit 1), true)
$$;
