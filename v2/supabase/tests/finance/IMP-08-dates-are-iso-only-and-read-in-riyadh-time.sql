-- IMP-08 — an export's dates are ISO only and read in Riyadh time (QA-538; D20, V610). With the server on UTC and a
-- day-first date style: a time with no zone late on 30 Sep stays on 30 Sep; the same time marked Z is 1 Oct in Riyadh;
-- 03/04/2026 and a day that does not exist are refused, so their rows are held, never guessed; an expense's time with no
-- zone is Riyadh's clock. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-date-is-read-in-the-servers-zone.sql.
set local timezone = 'UTC';
set local datestyle = 'SQL, DMY';
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);

select test.eq(finance.row_date('{"d": "2026-09-30T23:30"}', 'd'), '2026-09-30'::date,
  'a time with no zone is Riyadh''s clock: still 30 Sep');
select test.eq(finance.row_date('{"d": "2026-09-30T23:30:00Z"}', 'd'), '2026-10-01'::date,
  'a time with a zone is that instant: 1 Oct in Riyadh');
select test.eq(finance.row_date('{"d": "2026-09-30"}', 'd'), '2026-09-30'::date, 'a day is that day');
select test.raises($$select finance.row_date('{"d": "03/04/2026"}', 'd')$$, 'P0001',
  'a day in another style is refused, never read by the date style', 'finance.bad_date');
select test.raises($$select finance.row_date('{"d": "2026-02-30"}', 'd')$$, 'P0001',
  'a day that does not exist is refused, never rolled into March', 'finance.bad_date');
select test.ok((select provolatile = 's' from pg_proc where oid = 'finance.row_date(jsonb, text)'::regprocedure),
  'the reader is stable, not immutable');

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-D1', 'status', 'Fully Paid', 'created_on', '2026-09-30T23:30', 'total_sar', 100),
  jsonb_build_object('ref', 'TX-D2', 'status', 'Fully Paid', 'created_on', '03/04/2026', 'total_sar', 100)),
  now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-D1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 40,
                     'created_at', '2026-09-30T23:30')),
  now() - interval '1 day');
select test.as_owner();
select test.eq((select created_on from finance.invoice where ref = 'TX-D1'), '2026-09-30'::date,
  'the invoice keeps its Riyadh day');
select test.eq((select reason_key from finance.import_held where ref = 'TX-D2'), 'bad_date',
  'a day in another style holds its row');
select test.eq((select created_at_src from finance.expense_line e join finance.invoice i on i.id = e.invoice_id
                where i.ref = 'TX-D1'), '2026-09-30 20:30:00+00'::timestamptz,
  'an expense''s time with no zone is Riyadh''s clock');
