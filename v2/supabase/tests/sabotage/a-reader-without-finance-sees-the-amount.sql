-- Sabotage: a-reader-without-finance-sees-the-amount
-- Breaks: sql:RLINE-01
-- Expect: a reader without View on Finance sees no amount
-- An issued report shows its money to a reader with no View on Finance (V458).
create or replace function report.get(p_report uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r report.report;
  money boolean;
  body jsonb;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null;
  if r.id is null or not report.sees(me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  money := true;
  body := case when r.status in ('issued', 'superseded') then r.snapshot else report.snapshot_of(r) end;
  if not money then
    body := pg_catalog.jsonb_set(body, '{sections}', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_set(s, '{lines}', coalesce((
               select pg_catalog.jsonb_agg(case when l ? 'amount' then pg_catalog.jsonb_set(l, '{amount}', 'null'::jsonb)
                                                else l end order by o)
               from pg_catalog.jsonb_array_elements(s -> 'lines') with ordinality y(l, o)), '[]'::jsonb)) order by so)
      from pg_catalog.jsonb_array_elements(body -> 'sections') with ordinality z(s, so)), '[]'::jsonb));
  end if;
  return pg_catalog.jsonb_build_object(
    'id', r.id, 'department_id', r.department_id, 'kind', r.kind, 'period_start', r.period_start,
    'period_end', r.period_end, 'status', r.status, 'number', r.number, 'issued_at', r.issued_at,
    'issued_by', r.issued_by, 'supersedes_id', r.supersedes_id, 'correction_note', r.correction_note,
    'superseded_by', (select pg_catalog.jsonb_build_object('id', x.id, 'number', x.number) from report.report x
                      where x.supersedes_id = r.id and x.status in ('issued', 'superseded')),
    'snapshot_sha256', r.snapshot_sha256, 'money_masked', not money,
    'can_edit', r.status in ('draft', 'in_review') and report.can_edit(me, r.department_id),
    'lines', case when r.status in ('draft', 'in_review') then coalesce((
               select pg_catalog.jsonb_agg(report.line_json(l) order by l.section_key, l.sort)
               from report.line l where l.report_id = r.id and l.deleted_at is null), '[]'::jsonb) end,
    'body', body, 'version', r.version);
end
$$;
