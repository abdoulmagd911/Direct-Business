-- UNI-03 — a document imported through both doors counts once (L18, the two-totals fix, part d).
-- The old import door writes finance.invoice (the manual store); the new engine writes
-- work.import_record. The same document in both stores must count once, as the manual row,
-- on both reads — the Overview and the unified Ledger must agree. Two shapes: a standalone
-- invoice, whose import row carries the number only as the invoice number, and an
-- unconsolidated transaction, whose manual row carries no invoice number. Keying the dedup on
-- the two number columns separately never matches either shape, so the document counted twice;
-- the dedup keys on the document's own number (coalesce of the two). Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
-- one partner, linked to both manual invoices by its payments client id
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Both Doors Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '84018', 'made up', 'postpaid');
-- the two documents, via the invoice import that writes finance.invoice (the manual store)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-UNI-3G', 'client_id', '84018', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'TX-UNI-3H', 'client_id', '84018', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400, 'consolidation_status', 'Consolidation complete')),
  now() - interval '1 day');
-- an approved expense on the transaction, so it is costed (the standalone stays provisional, cost pending)
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-UNI-3H', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 100,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');
-- the same two documents again, via the new import engine's tables
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-3.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'invoice', null, 'TX-UNI-3G', current_setting('t.d')::date, 300, 300, 50, 250, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', 'TX-UNI-3H', 'TX-UNI-3H', current_setting('t.d')::date, 400, 400, 100, 300, true, current_setting('t.head')::uuid);
select test.done();
-- the two reads, same period: two units, revenue 700 (300 + 400), cost 100, profit 300;
-- the standalone sits apart as Provisional; no import copy of either document is counted
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ov', api.finance_period('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.ul', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.ov')::jsonb ->> 'units')::int, 2, 'the Overview counts two units, not four');
select test.eq((current_setting('t.ov')::jsonb ->> 'revenue')::numeric, 700.00, 'the Overview revenue counts each document once');
select test.eq((current_setting('t.ov')::jsonb ->> 'cost')::numeric, 100.00, 'the Overview cost counts only the costed unit');
select test.eq((current_setting('t.ov')::jsonb ->> 'profit')::numeric, 300.00, 'the Overview profit counts only the costed unit');
select test.eq((current_setting('t.ov')::jsonb -> 'provisional' ->> 'units')::int, 1, 'one Provisional unit, the standalone');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'units')::int, 2, 'the Ledger counts two units, not four');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'revenue')::numeric, 700.00, 'the Ledger revenue is 700');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'cost')::numeric, 100.00, 'the Ledger cost is 100');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'profit')::numeric, 300.00, 'the Ledger profit is 300');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'manual_units')::int, 2, 'both counted rows are manual');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'import_units')::int, 0, 'no import copy is counted');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'without_cost')::int, 1, 'one row without cost in the Ledger');
-- the two totals agree, figure for figure, and By service agrees with the Overview revenue
select test.eq((current_setting('t.ov')::jsonb ->> 'revenue')::numeric = (current_setting('t.ul')::jsonb -> 'totals' ->> 'revenue')::numeric
                and (current_setting('t.ov')::jsonb ->> 'cost')::numeric = (current_setting('t.ul')::jsonb -> 'totals' ->> 'cost')::numeric
                and (current_setting('t.ov')::jsonb ->> 'profit')::numeric = (current_setting('t.ul')::jsonb -> 'totals' ->> 'profit')::numeric
                and (current_setting('t.ov')::jsonb ->> 'units')::int = (current_setting('t.ul')::jsonb -> 'totals' ->> 'units')::int,
  true, 'the Overview totals equal the unified Ledger totals for the same period');
select test.eq((select (api.finance_income_by_service('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric),
  700.00, 'By service revenue is 700, the same as the Overview');
-- the duplicate leaves no row and no invoice behind: one row per document, both manual,
-- and one invoice for the standalone (the transaction's invoice is listed under its own id,
-- with no invoice number, as an unconsolidated transaction is)
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r
                where (r ->> 'transaction_number') in ('TX-UNI-3G', 'TX-UNI-3H')), 2,
  'the Ledger lists one row per document, not one per door');
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'rows') r
                where (r ->> 'transaction_number') in ('TX-UNI-3G', 'TX-UNI-3H') and (r ->> 'source') = 'manual'), 2,
  'both counted rows are the manual ones');
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'invoices') v
                where (v ->> 'invoice_number') = 'TX-UNI-3G'), 1,
  'the standalone lists one invoice, not one per door');
