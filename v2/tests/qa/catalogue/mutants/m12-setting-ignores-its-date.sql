-- Mutant m12-setting-ignores-its-date: setting_at reads the latest row whatever its date
CREATE OR REPLACE FUNCTION core.setting_at(p_key text, p_department uuid, p_at date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v jsonb;
begin
  if not exists (select 1 from core.setting_def d where d.key = p_key) then
    raise exception using errcode = 'P0001', message = 'setting.unknown_key', detail = p_key;
  end if;
  if p_department is not null then
    select s.value into v from core.setting s
    where s.key = p_key and s.department_id = p_department and s.deleted_at is null
    order by s.valid_from desc limit 1;
    if found then
      return v;
    end if;
  end if;
  select s.value into v from core.setting s
  where s.key = p_key and s.department_id is null and s.deleted_at is null
  order by s.valid_from desc limit 1;
  if found then
    return v;
  end if;
  return (select d.default_value from core.setting_def d where d.key = p_key);
end
$function$
;
