-- Sabotage: settings-ignore-the-department
-- Breaks: sql:SET-01
-- Expect: the department's row in force on 15 Sep
-- setting_at reads only company-wide rows: a department's own value is ignored (§3.2).
create or replace function core.setting_at(p_key text, p_department uuid, p_at date) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.value from core.setting s where s.key = p_key and s.department_id is null and s.valid_from <= p_at
       and s.deleted_at is null order by s.valid_from desc limit 1),
    (select d.default_value from core.setting_def d where d.key = p_key))
$$;
