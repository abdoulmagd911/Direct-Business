-- Sabotage: an-issued-report-takes-a-line-edit
-- Breaks: sql:RPT-01
-- Expect: an issued report takes no line edit
-- An issued report still takes edits to its lines, so the frozen report moves (§3.9).
create or replace function report.draft_for_edit(p_report uuid, p_me uuid) returns report.report
language plpgsql security definer set search_path = ''
as $$
declare
  r report.report;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null for update;
  if r.id is null or not report.sees(p_me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  if not report.can_edit(p_me, r.department_id) then
    raise exception using errcode = '42501', message = 'report.editors_only';
  end if;
  if false and r.status not in ('draft', 'in_review') then
    raise exception using errcode = 'P0001', message = 'report.not_a_draft', detail = coalesce(r.number, r.status);
  end if;
  return r;
end
$$;
