-- IMP-09 — an expense dated in the future is held (QA-539; D20, D21), as an invoice or a receipt is: nothing of it is
-- written and the transaction's cost stays what it was. An expense dated today is written. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-expense-in-the-future-is-written.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 3)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-F1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500)),
  now() - interval '1 hour');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-F1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 90,
                     'created_at', (core.riyadh_today() + 2)::text),
  jsonb_build_object('ref', 'TX-F1', 'expense_type', 'Visa', 'status', 'Approved', 'amount_sar', 10,
                     'created_at', core.riyadh_today()::text)),
  now() - interval '1 hour');
select test.as_owner();
select test.eq((select jsonb_agg(jsonb_build_array(h.row_no, h.reason_key) order by h.row_no) from finance.import_held h
                join finance.import_batch b on b.id = h.batch_id where b.file = 'expenses'),
  '[[1, "date_in_future"]]'::jsonb, 'the expense dated in the future is held');
select test.eq((select jsonb_agg(e.expense_type order by e.expense_type) from finance.expense_line e),
  '["Visa"]'::jsonb, 'only the expense dated today is written');
