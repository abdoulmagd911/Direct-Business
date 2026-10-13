-- Mutant m10-departments-open: in_my_departments answers yes for every department
CREATE OR REPLACE FUNCTION authz.in_my_departments(p_department uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select true or p.department_id = p_department
           or exists (select 1 from core.person_department pd
                      where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
    from core.person p left join core.role r on r.id = p.role_id
    where p.id = authz.me()), false)
$function$
;
