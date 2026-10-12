-- QA 2 repro: D21 / §3.11.2 — an unreadable or missing amount is held, never written.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-41Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'))), now() - interval '1 day');
select test.as_owner();
select test.ok(not exists (select 1 from finance.invoice where ref = 'TX-41Q'), 'a paid row with no total is not written');
select test.ok(exists (select 1 from finance.import_held where ref = 'TX-41Q'), 'it is held with a reason');
