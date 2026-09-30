-- Sabotage: a-default-over-an-admins-value
-- Breaks: sql:SETS-02
-- Expect: a changed default never overwrites the value an admin set before it
-- A changed default lands over an admin's value (V155).
create or replace function core.setting_defaults_sync(p_defaults jsonb) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n int;
  k int;
begin
  insert into core.setting (key, department_id, value, valid_from, reason)
  select d ->> 'key', null, d -> 'value', date '2000-01-01', 'default'
  from pg_catalog.jsonb_array_elements(p_defaults) d
  where not exists (select 1 from core.setting s where s.key = d ->> 'key');
  get diagnostics n = row_count;
  update core.setting s set deleted_at = pg_catalog.now(), delete_reason = 'default changed again'
  from pg_catalog.jsonb_array_elements(p_defaults) d
  where s.key = d ->> 'key' and s.department_id is null and s.deleted_at is null and s.reason = 'default'
    and s.valid_from = core.riyadh_today() and s.valid_from > date '2000-01-01' and s.value is distinct from d -> 'value'
    and not exists (select 1 from core.setting x where x.key = s.key and x.department_id is null
                    and x.deleted_at is null and x.valid_from > s.valid_from);
  insert into core.setting (key, department_id, value, valid_from, reason)
  select d ->> 'key', null, d -> 'value', core.riyadh_today(), 'default'
  from pg_catalog.jsonb_array_elements(p_defaults) d
  cross join lateral (select s.reason, s.value, s.valid_from from core.setting s
                      where s.key = d ->> 'key' and s.department_id is null and s.deleted_at is null
                      order by s.valid_from desc limit 1) cur
  where cur.value is distinct from d -> 'value' and cur.valid_from < core.riyadh_today();
  get diagnostics k = row_count;
  return n + k;
end
$$;
