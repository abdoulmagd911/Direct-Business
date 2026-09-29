-- Sabotage: view-changes-a-setting
-- Breaks: sql:SETW-01
-- Expect: a head with View on App cannot change its settings
-- Changing a setting asks only for View on its group.
create or replace function core.setting_set(p_key text, p_department uuid, p_value jsonb, p_valid_from date default null,
                                 p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d core.setting_def;
  me uuid;
  why text;
  day date;
  bad text;
  req uuid;
  s core.setting;
begin
  select * into d from core.setting_def where key = p_key and active;
  if d.id is null then
    raise exception using errcode = 'P0002', message = 'setting.unknown_key', detail = p_key;
  end if;
  me := authz.require(d.group_page, 'view');
  why := core.access_reason(p_reason);
  if p_department is not null
     and not exists (select 1 from core.department x where x.id = p_department and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  bad := core.json_check(d.schema, p_value);
  if bad is not null then
    raise exception using errcode = 'P0001', message = 'setting.invalid_value', detail = bad;
  end if;
  if d.effective_dated then
    day := coalesce(p_valid_from, core.riyadh_today());
  elsif p_valid_from is not null and p_valid_from <> core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'setting.not_effective_dated', detail = p_key;
  else
    day := core.riyadh_today();
  end if;
  req := audit.begin('ui', 'setting.changed', pg_catalog.jsonb_build_object('key', p_key), why);
  update core.setting set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where key = p_key and department_id is not distinct from p_department and valid_from = day and deleted_at is null;
  insert into core.setting (key, department_id, value, valid_from, reason)
  values (p_key, p_department, p_value, day, why)
  returning * into s;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', s.id, 'valid_from', s.valid_from, 'request_id', req);
end
$$;
