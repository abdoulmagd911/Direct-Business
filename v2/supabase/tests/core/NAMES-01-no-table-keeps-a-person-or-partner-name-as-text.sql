-- NAMES-01 — no table keeps a person's or partner's name as text outside the person and partner tables: everything
-- else refers to them by id and shows the current name (A20, V58 — names typed into records went stale when someone
-- was renamed). A raw column copied from a source file is allowed only when listed below with its reason.
-- Sabotage: supabase/tests/sabotage/a-name-typed-into-a-record.sql.
do $$
declare
  found text;
begin
  select string_agg(format('%s.%s.%s', c.table_schema, c.table_name, c.column_name), E'\n    ' order by 1) into found
  from information_schema.columns c
  where c.table_schema = any (test.v2_schemas())
    and c.data_type in ('text', 'character varying', 'character', 'USER-DEFINED')
    and (c.data_type <> 'USER-DEFINED' or c.udt_name = 'citext')
    and c.column_name ~ '(^|_)(person|partner|customer|client|owner|manager|assignee|salesman|submitter|approver|employee|staff|helper|participant|evaluator|editor|reviewer|signatory|paid_by|nickname|full_name|display_name|contact_name)(_|$)'
    -- the person and partner tables themselves, and a person's own profile
    and (c.table_schema, c.table_name) not in (('core', 'person'), ('core', 'person_profile'), ('partner', 'partner'),
                                                ('partner', 'contact'))
    -- raw values copied from a source file, never shown as a person (added by the step that brings them):
    and format('%s.%s.%s', c.table_schema, c.table_name, c.column_name) not in (
      'finance.invoice.customer_name', 'finance.invoice.customer_name2', 'finance.invoice.salesman_raw',
      'finance.expense_line.submitter', 'finance.expense_line.approver', 'finance.receipt.paid_by');
  perform test.ok(found is null, format(E'names kept as text (refer by id instead):\n    %s', found));
end $$;
