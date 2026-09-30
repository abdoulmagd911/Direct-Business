-- Sabotage: reports-to-asks-about-me
-- Breaks: sql:VIS-01
-- Expect: a person reports to their direct manager, asked by anyone
-- The appraisal line is asked with the signed-in person as the manager, whoever the rule is deciding for (V96).
create or replace function authz.reports_to(p_person uuid, p_manager uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.manager_id = authz.me() from core.person p where p.id = p_person), false)
$$;
