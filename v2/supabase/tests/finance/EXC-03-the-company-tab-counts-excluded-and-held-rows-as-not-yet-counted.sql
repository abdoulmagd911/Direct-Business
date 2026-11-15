-- EXC-03 — the company tab's "Not yet counted" counts the excluded and the held rows (Landing 25, F-A/A1).
-- Excluded rows are invisible to the ledger by design, so the tab reads them through
-- api.finance_company_not_counted; held rows are recorded for the company but not paid yet, so the Ledger —
-- which counts fully-paid rows only — leaves them out too. Both must be named with their reason, never a
-- silent gap. A name rule catches only a row that carries no client ID (EXC-01), so the counted row keeps its
-- client ID and the excluded row carries only the alias name. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Exc3 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '88007', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.p')::uuid, 'name', 'Made Up Excluded Trading', 'made up', 'alias');
-- one counted row (Fully Paid, client ID, 1000), one excluded row (Fully Paid, alias name only, 300),
-- one held row (Published, unpaid, client ID, 400)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-X3-1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'client_id', '88007', 'customer_name', 'Made Up Counted Co'),
  jsonb_build_object('ref', 'TX-X3-2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
                     'customer_name', 'Made Up Excluded Trading'),
  jsonb_build_object('ref', 'TX-X3-3', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 400,
                     'client_id', '88007', 'customer_name', 'Made Up Held Co')),
  now() - interval '1 day');
select test.act(current_setting('t.head')::uuid);
insert into finance.exclusion_rule (kind, value_raw, mode, reason, created_by) values
  ('name', 'Made Up Excluded Trading', 'exclude', 'made up: the group is not a client', current_setting('t.head')::uuid);
select test.done();
select test.as_person(current_setting('t.head')::uuid);
-- the not-yet-counted read names both gaps: 1 excluded (300) and 1 held (400)
select set_config('t.nc', api.finance_company_not_counted(current_setting('t.p')::uuid, '2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.nc')::jsonb ->> 'excluded_units')::int, 1,
  'one excluded row for this company');
select test.eq((current_setting('t.nc')::jsonb ->> 'excluded_revenue')::numeric, 300.00,
  'the excluded row is 300');
select test.eq((current_setting('t.nc')::jsonb ->> 'held_units')::int, 1,
  'one held row for this company');
select test.eq((current_setting('t.nc')::jsonb ->> 'held_revenue')::numeric, 400.00,
  'the held row is 400');
-- and the ledger counts only the one counted row — the two gaps are not in its figures
select set_config('t.tab', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int, 1,
  'the tab counts one unit — the excluded and held rows are not in it');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric, 1000.00,
  'the tab revenue is 1000 — the excluded 300 and held 400 are not in it');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'transaction_number' in ('TX-X3-2', 'TX-X3-3')), 0,
  'neither the excluded nor the held row is in the tab list');
-- a company with no gaps answers zeros, so the tab can say everything is counted
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Exc3 Clean Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select test.eq((api.finance_company_not_counted(current_setting('t.q')::uuid, '2026-01-01'::date, '2026-12-31'::date) ->> 'excluded_units')::int, 0,
  'a company with no excluded rows answers 0');
select test.eq((api.finance_company_not_counted(current_setting('t.q')::uuid, '2026-01-01'::date, '2026-12-31'::date) ->> 'held_units')::int, 0,
  'a company with no held rows answers 0');
