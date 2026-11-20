-- UNI-07 — the organisation's Finance tab equals the Finance page's line for that organisation, difference 0,
-- with the lists applied (Landing 32). The tab asks the unified Ledger for one organisation; the page asks for
-- all and takes that organisation's line. With a row excluded by hand, a client ID merged in from another
-- organisation, rows recorded here and imported rows — the two answer the same figures, figure for figure; and
-- with the imported rows hidden, the rows recorded here alone agree too. A row that does not count is in
-- neither. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin', 'commercial')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni7 Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni7 Other Half',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '990701', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.q')::uuid, 'payments_client_id', '990702', 'made up', 'postpaid');
-- recorded here: 1000 (cost 200) and 500 (no cost) at the organisation; 300 at the other half
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'U7-M1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000, 'client_id', '990701'),
  jsonb_build_object('ref', 'U7-M2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500, 'client_id', '990701'),
  jsonb_build_object('ref', 'U7-M3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300, 'client_id', '990702')),
  now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'U7-M1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 200, 'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');
-- imported: 800 (cost 80) and 250 (cost 50, to be excluded) at the organisation; 400 (cost 40) at the other half
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
select gen_random_uuid(), p::uuid, 'invoice_export', 'made-up-u7.csv', current_setting('t.head')::uuid
from unnest(array[current_setting('t.p'), current_setting('t.q')]) p;
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
select v.p::uuid, (select b.id from work.import_batch b where b.partner_id = v.p::uuid), 'transaction', v.tx, v.tx || '-INV',
       current_setting('t.d')::date, v.amt, v.amt, v.cost, v.amt - v.cost, true, current_setting('t.head')::uuid
from (values (current_setting('t.p'), 'U7-I1', 800::numeric, 80::numeric), (current_setting('t.p'), 'U7-I2', 250, 50),
             (current_setting('t.q'), 'U7-I3', 400, 40)) v(p, tx, amt, cost);
select test.done();
-- the lists: one row excluded by hand; the other half's client ID merged into the organisation
select test.as_person(current_setting('t.admin')::uuid);
select api.finance_row_exclude(current_setting('t.p')::uuid, 'U7-I2', 'made up: a test booking');
select api.finance_merge_rule_save(null,
  jsonb_build_object('kind', 'client_id', 'value', '990702', 'partner_id', current_setting('t.p'), 'reason', 'made up: one organisation'), null, 'made up');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.tab', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);
select set_config('t.page', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.line', (select b from pg_catalog.jsonb_array_elements(current_setting('t.page')::jsonb -> 'by_company') b
                             where b ->> 'partner_id' = current_setting('t.p'))::text, true);
-- what must count: 1000 + 500 + 300 recorded here, 800 + 400 imported = 3000; cost 200 + 80 + 40 = 320
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric, 3000.00, 'the tab counts 3000: the merged half in, the excluded row out');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'cost')::numeric, 320.00, 'and the known costs');
-- the tab equals the page's line, figure for figure: difference 0
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric - (current_setting('t.line')::jsonb ->> 'revenue')::numeric, 0::numeric,
  'revenue: the tab minus the page''s line is 0');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'cost')::numeric - (current_setting('t.line')::jsonb ->> 'cost')::numeric, 0::numeric,
  'cost: difference 0');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'profit')::numeric - (current_setting('t.line')::jsonb ->> 'profit')::numeric, 0::numeric,
  'profit: difference 0');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int - (current_setting('t.line')::jsonb ->> 'units')::int, 0, 'units: difference 0');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'received')::numeric - (current_setting('t.line')::jsonb ->> 'received')::numeric, 0::numeric,
  'received: difference 0');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'remaining')::numeric - (current_setting('t.line')::jsonb ->> 'remaining')::numeric, 0::numeric,
  'remaining: difference 0');
-- the tab's own client-side sum (the counted rows it lists) is the same figure: with the imported rows…
select test.eq((select sum((r ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r where (r ->> 'counted')::boolean),
  (current_setting('t.line')::jsonb ->> 'revenue')::numeric, 'the counted rows the tab lists add up to the page''s line');
-- …and with the imported rows hidden: the rows recorded here alone, on both reads
select test.eq((select sum((r ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where (r ->> 'counted')::boolean and r ->> 'source' = 'manual'),
  (select sum((r ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(current_setting('t.page')::jsonb -> 'rows') r
   where (r ->> 'counted')::boolean and r ->> 'source' = 'manual' and r ->> 'partner_id' = current_setting('t.p')),
  'imported hidden: the rows recorded here agree, difference 0');
select test.eq((select sum((r ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where (r ->> 'counted')::boolean and r ->> 'source' = 'manual'), 1800.00, 'and they are 1000 + 500 + 300');
-- the excluded row is on the tab, not counted, and in no figure
select test.eq((select r ->> 'counted' from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r where r ->> 'number' = 'U7-I2'),
  'false', 'the excluded row is listed on the tab, not counted');
-- and the Finance page's top figures agree with its Ledger
select test.eq((api.finance_period('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric,
  (current_setting('t.page')::jsonb -> 'totals' ->> 'revenue')::numeric, 'the Overview equals the Ledger total');
