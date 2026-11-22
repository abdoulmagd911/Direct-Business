-- FNC-01 — a Pending or Draft invoice is listed as not yet counted, and no total moves (Landing 37, Finance F-C,
-- A6). The unified Ledger answers `not_yet_counted`: one row per document that is not fully paid yet, with its
-- amount and what is left on it. Revenue, Cost, Profit, received, remaining, the organisations' lines, the counted
-- rows and the Finance page's own figures are exactly what they were before the document was typed; they move only
-- when it is paid, and then by exactly its amount. A cancelled document waits for nothing and is not listed. The
-- organisation's Finance tab is the same read with the organisation set. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-pending-invoice-is-counted-in-revenue.sql,
--           supabase/tests/sabotage/a-cancelled-invoice-is-listed-as-not-yet-counted.sql,
--           supabase/tests/sabotage/an-imported-unpaid-row-is-left-off-the-not-yet-counted-list.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.none', test.person('Test No Finance', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.none')::uuid, 'finance', 'none', 'made up: no Finance access');
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Fnc1 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '990371', 'made up', 'postpaid');
-- one paid invoice (1000) recorded here, and one paid imported row (500): the figures before anything waits
select api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-PAID-1', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000, 'client_id', '990371'), 'made up');
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-fc.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid, status_text, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', 'FC-IMP-PAID', 'FC-IMP-PAID', current_setting('t.d')::date, 500, 500, true, 'Invoice - Fully Paid', current_setting('t.head')::uuid);
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.before', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.tab_before', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);
select set_config('t.page_before', api.finance_period('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.before')::jsonb -> 'totals' ->> 'not_yet_counted_units')::int, 0,
  'nothing waits before a pending invoice is typed');
select test.eq(current_setting('t.before')::jsonb -> 'not_yet_counted', '[]'::jsonb,
  'the not-yet-counted list is empty, not missing');

-- typed by hand: a Pending one for the organisation, a Draft one for nobody known, a Cancelled one; and two
-- imported rows that are not confirmed paid — one waiting, one cancelled
select set_config('t.pend', api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-PEND-1', 'kind', 'transaction',
  'status', 'Pending', 'created_on', current_setting('t.d'), 'total_sar', 100, 'client_id', '990371'), 'made up')::text, true);
select api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-DRAFT-1', 'kind', 'transaction',
  'status', 'Draft', 'created_on', current_setting('t.d'), 'total_sar', 100, 'customer_name', 'Made Up Nobody Known'), 'made up');
select api.finance_row_add('invoice', jsonb_build_object('ref', 'FC-CANC-1', 'kind', 'transaction',
  'status', 'Cancelled', 'created_on', current_setting('t.d'), 'total_sar', 50, 'client_id', '990371'), 'made up');
select test.act(current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid, status_text, direct_url, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', 'FC-IMP-WAIT', null, current_setting('t.d')::date, 300, 300, false, 'Waiting for Issuing', 'https://example.invalid/t/FC-IMP-WAIT', current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', 'FC-IMP-CANC', null, current_setting('t.d')::date, 70, 70, false, 'Cancelled', null, current_setting('t.head')::uuid);
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.after', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.tab_after', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);

-- (1) no figure moved: every total the Ledger answered before, the rows, the invoices and the organisations' lines
select test.eq((current_setting('t.after')::jsonb -> 'totals' ->> 'revenue')::numeric
               - (current_setting('t.before')::jsonb -> 'totals' ->> 'revenue')::numeric, 0::numeric,
  'Revenue is unchanged by the documents that wait');
select test.eq((current_setting('t.after')::jsonb -> 'totals') - 'not_yet_counted_units' - 'not_yet_counted_amount' - 'unconfirmed_import_units',
               (current_setting('t.before')::jsonb -> 'totals') - 'not_yet_counted_units' - 'not_yet_counted_amount' - 'unconfirmed_import_units',
  'every counted total is unchanged');
select test.eq(current_setting('t.after')::jsonb -> 'rows', current_setting('t.before')::jsonb -> 'rows',
  'the counted rows are unchanged');
select test.eq(current_setting('t.after')::jsonb -> 'by_company', current_setting('t.before')::jsonb -> 'by_company',
  'the organisations'' lines are unchanged');
select test.eq(current_setting('t.after')::jsonb -> 'invoices', current_setting('t.before')::jsonb -> 'invoices',
  'the invoices list is unchanged');
select test.eq(api.finance_period('2026-01-01'::date, '2026-12-31'::date), current_setting('t.page_before')::jsonb,
  'the Finance page''s own figures are unchanged');

-- (2) the two cancelled ones are not listed; the three that wait are, with their amount
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-CANC-1'), 0,
  'a cancelled invoice is not listed');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-IMP-CANC'), 0,
  'a cancelled imported row is not listed');
select test.eq((current_setting('t.after')::jsonb -> 'totals' ->> 'not_yet_counted_units')::int, 3,
  'three documents wait: the Pending, the Draft and the imported one');
select test.eq((current_setting('t.after')::jsonb -> 'totals' ->> 'not_yet_counted_amount')::numeric, 500.00,
  'what waits is 100 + 100 + 300');
select test.eq((select pg_catalog.jsonb_agg(n ->> 'number' order by n ->> 'number')
                from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'not_yet_counted') n),
               '["FC-DRAFT-1", "FC-IMP-WAIT", "FC-PEND-1"]'::jsonb,
  'the list names the three by their number');
select test.eq((select pg_catalog.jsonb_build_object('amount', (n ->> 'amount')::numeric, 'remaining', (n ->> 'remaining')::numeric,
                         'status', n ->> 'status', 'source', n ->> 'source', 'partner', n ->> 'partner_id',
                         'name', n ->> 'trade_name_en', 'transaction', n ->> 'transaction_number')
                from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-PEND-1'),
               pg_catalog.jsonb_build_object('amount', 100.00, 'remaining', 100.00, 'status', 'Pending', 'source', 'manual',
                 'partner', current_setting('t.p'), 'name', 'Made Up Fnc1 Co', 'transaction', 'FC-PEND-1'),
  'the Pending row says its amount, what is left, its status and its organisation');
select test.eq((select (n ->> 'partner_id') is null and n ->> 'status' = 'Draft'
                from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-DRAFT-1'), true,
  'the Draft row of nobody known is listed with no organisation');
select test.eq((select pg_catalog.jsonb_build_object('source', n ->> 'source', 'amount', (n ->> 'amount')::numeric,
                         'link', n ->> 'direct_url', 'status', n ->> 'status')
                from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-IMP-WAIT'),
               pg_catalog.jsonb_build_object('source', 'import', 'amount', 300.00,
                 'link', 'https://example.invalid/t/FC-IMP-WAIT', 'status', 'Waiting for Issuing'),
  'the imported unpaid row is listed with its Direct link');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.after')::jsonb -> 'rows') r
                where r ->> 'number' in ('FC-PEND-1', 'FC-DRAFT-1', 'FC-IMP-WAIT', 'FC-CANC-1')), 0,
  'none of them is among the counted rows');

-- (3) the organisation's tab: the same read with the organisation set — its two are listed, its totals stand
select test.eq((current_setting('t.tab_after')::jsonb -> 'totals' ->> 'revenue')::numeric,
               (current_setting('t.tab_before')::jsonb -> 'totals' ->> 'revenue')::numeric,
  'the organisation''s Revenue is unchanged');
select test.eq((current_setting('t.tab_after')::jsonb -> 'totals' ->> 'revenue')::numeric, 1500.00,
  'the organisation''s Revenue is its two paid documents');
select test.eq((select pg_catalog.jsonb_agg(n ->> 'number' order by n ->> 'number')
                from pg_catalog.jsonb_array_elements(current_setting('t.tab_after')::jsonb -> 'not_yet_counted') n),
               '["FC-IMP-WAIT", "FC-PEND-1"]'::jsonb,
  'the organisation''s tab lists its own two that wait, not the Draft of nobody known');
select test.eq((current_setting('t.tab_after')::jsonb -> 'totals' ->> 'not_yet_counted_amount')::numeric, 400.00,
  'what waits for the organisation is 100 + 300');

-- (4) part of it arrives: still listed, 60 left, Revenue still unchanged
select api.finance_row_add('receipt', jsonb_build_object('invoice_id', current_setting('t.pend')::jsonb ->> 'id',
  'amount_sar', 40, 'paid_on', current_setting('t.d')), 'made up');
select set_config('t.part', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((select pg_catalog.jsonb_build_object('amount', (n ->> 'amount')::numeric, 'received', (n ->> 'received')::numeric,
                         'remaining', (n ->> 'remaining')::numeric)
                from pg_catalog.jsonb_array_elements(current_setting('t.part')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-PEND-1'),
               pg_catalog.jsonb_build_object('amount', 100.00, 'received', 40.00, 'remaining', 60.00),
  'part paid: the row still waits, with 60 left');
select test.eq((current_setting('t.part')::jsonb -> 'totals' ->> 'revenue')::numeric,
               (current_setting('t.before')::jsonb -> 'totals' ->> 'revenue')::numeric,
  'part paid moves no Revenue');

-- (5) it is paid: it leaves the list and Revenue rises by exactly its amount
select test.as_owner();
select set_config('t.v', (select version from finance.invoice where id = (current_setting('t.pend')::jsonb ->> 'id')::uuid)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_row_edit('invoice', (current_setting('t.pend')::jsonb ->> 'id')::uuid, '{"status": "Fully Paid"}',
  current_setting('t.v')::int, 'made up: paid');
select set_config('t.paid', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.paid')::jsonb -> 'totals' ->> 'revenue')::numeric
               - (current_setting('t.before')::jsonb -> 'totals' ->> 'revenue')::numeric, 100.00,
  'once paid, Revenue rises by exactly the invoice''s 100');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.paid')::jsonb -> 'not_yet_counted') n
                where n ->> 'number' = 'FC-PEND-1'), 0,
  'once paid, it is no longer listed as waiting');
select test.eq((current_setting('t.paid')::jsonb -> 'totals' ->> 'not_yet_counted_units')::int, 2,
  'two documents still wait');

-- (6) a person below View on Finance reads none of it
select test.as_person(current_setting('t.none')::uuid);
select test.raises($$select api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)$$,
  '42501', 'no level on Finance reads no Ledger', 'access.needs_level');
