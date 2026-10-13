-- Sabotage: any-reader-edits-a-report
-- Breaks: sql:RPT-03
-- Expect: but writes nothing in them
-- Anyone who can read a department's reports may write its drafts, named editor or not (V57, V79).
create or replace function report.can_edit(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select work.sees_department(p_person, p_department)
         and (authz.level_of(p_person, 'reports') >= 'view'
              or exists (select 1 from report.editor e
                         where e.department_id = p_department and e.person_id = p_person and e.deleted_at is null))
$$;
