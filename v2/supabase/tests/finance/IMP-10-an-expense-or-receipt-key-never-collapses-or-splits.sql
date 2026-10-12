-- IMP-10 — an expense's or a receipt's key neither collapses two rows nor splits one (QA-539; D21, V622). Two expenses of
-- one type with no created time stay two, and the next file finds both again; an expense that comes back with another
-- created time is the same expense, never a second cost, and an older file that would undo it is held; two receipts of
-- one method on one day stay two; a receipt whose amount is corrected is changed, never doubled. Every value is made up.
-- Sabotages: supabase/tests/sabotage/two-expenses-without-a-time-are-one.sql,
-- supabase/tests/sabotage/a-new-expense-time-is-a-second-cost.sql, supabase/tests/sabotage/a-receipts-amount-is-in-its-key.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-K1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900),
  jsonb_build_object('ref', 'TX-K2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900)),
  now() - interval '5 hours');

-- two of one type with no created time
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-K1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 100),
  jsonb_build_object('ref', 'TX-K1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 50),
  jsonb_build_object('ref', 'TX-K2', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 70,
                     'created_at', current_setting('t.d') || 'T10:00')),
  now() - interval '4 hours');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-K1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 100),
  jsonb_build_object('ref', 'TX-K1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 50),
  jsonb_build_object('ref', 'TX-K2', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 70,
                     'created_at', current_setting('t.d') || 'T11:00')),
  now() - interval '3 hours');
select test.as_owner();
select test.eq((select jsonb_agg(e.amount_sar order by e.amount_sar) from finance.expense_line e
                join finance.invoice i on i.id = e.invoice_id where i.ref = 'TX-K1' and e.deleted_at is null),
  '[50, 100]'::jsonb, 'two expenses of one type with no created time stay two, and the next file finds both');
select test.eq((select jsonb_agg(jsonb_build_array(e.amount_sar, (e.created_at_src at time zone 'Asia/Riyadh')::time::text))
                from finance.expense_line e join finance.invoice i on i.id = e.invoice_id
                where i.ref = 'TX-K2' and e.deleted_at is null),
  '[[70, "11:00:00"]]'::jsonb, 'an expense back with another created time is the same expense, never a second cost');

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-K2', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 70,
                     'created_at', current_setting('t.d') || 'T10:00')),
  now() - interval '3 hours 30 minutes');
select test.as_owner();
select test.eq((select count(*)::int from finance.expense_line e join finance.invoice i on i.id = e.invoice_id
                where i.ref = 'TX-K2' and e.deleted_at is null), 1, 'an older file never adds the old time back');
select test.eq((select jsonb_agg(h.ref) from finance.import_held h where h.reason_key = 'older_file'),
  '["TX-K2"]'::jsonb, 'it is held as older_file');

-- receipts
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('ref', 'TX-K1', 'method', 'Bank', 'amount_sar', 100, 'paid_on', current_setting('t.d')),
  jsonb_build_object('ref', 'TX-K1', 'method', 'Bank', 'amount_sar', 200, 'paid_on', current_setting('t.d')),
  jsonb_build_object('ref', 'TX-K2', 'method', 'Card', 'amount_sar', 300, 'paid_on', current_setting('t.d'))),
  now() - interval '2 hours');
select api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('ref', 'TX-K1', 'method', 'Bank', 'amount_sar', 100, 'paid_on', current_setting('t.d')),
  jsonb_build_object('ref', 'TX-K1', 'method', 'Bank', 'amount_sar', 200, 'paid_on', current_setting('t.d')),
  jsonb_build_object('ref', 'TX-K2', 'method', 'Card', 'amount_sar', 350, 'paid_on', current_setting('t.d'))),
  now() - interval '1 hour');
select test.as_owner();
select test.eq((select jsonb_agg(c.amount_sar order by c.amount_sar) from finance.receipt c
                join finance.invoice i on i.id = c.invoice_id where i.ref = 'TX-K1' and c.deleted_at is null),
  '[100, 200]'::jsonb, 'two receipts of one method on one day stay two');
select test.eq((select jsonb_agg(c.amount_sar) from finance.receipt c
                join finance.invoice i on i.id = c.invoice_id where i.ref = 'TX-K2' and c.deleted_at is null),
  '[350]'::jsonb, 'a corrected amount changes the receipt, never adds a second');
