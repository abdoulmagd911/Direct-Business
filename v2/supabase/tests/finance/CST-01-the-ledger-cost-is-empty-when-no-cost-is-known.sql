-- CST-01 — the Ledger's cost is EMPTY when no cost is known (Landing 32, A5), never 0; profit follows it. The
-- totals and each organisation's line answer null when none of their rows has a cost, the sum of the known
-- costs otherwise. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-unknown-cost-reads-as-zero.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
create function pg_temp.org(p_name text) returns text language sql as
$$ select api.partner_create(jsonb_build_object('trade_name_en', p_name,
     'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id' $$;
select set_config('t.a', pg_temp.org('Made Up No Cost Org'), true);
select set_config('t.b', pg_temp.org('Made Up Costed Org'), true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
select gen_random_uuid(), p::uuid, 'invoice_export', 'made-up-cst.csv', current_setting('t.head')::uuid
from unnest(array[current_setting('t.a'), current_setting('t.b')]) p;
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.a')::uuid, (select id from work.import_batch where partner_id = current_setting('t.a')::uuid), 'transaction', 'CST-A1', 'CST-A1-INV', current_setting('t.d')::date, 700, 700, null, null, true, current_setting('t.head')::uuid),
       (current_setting('t.a')::uuid, (select id from work.import_batch where partner_id = current_setting('t.a')::uuid), 'transaction', 'CST-A2', 'CST-A2-INV', current_setting('t.d')::date, 300, 300, null, null, true, current_setting('t.head')::uuid);
select test.done();

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ul', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'revenue')::numeric, 1000.00, 'revenue is known');
select test.eq(jsonb_typeof(current_setting('t.ul')::jsonb -> 'totals' -> 'cost'), 'null', 'no row has a cost: the total cost is empty, not 0');
select test.eq(jsonb_typeof(current_setting('t.ul')::jsonb -> 'totals' -> 'profit'), 'null', 'and so is the profit');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'without_cost')::int, 2, 'both rows are named as without cost');
select test.eq((select jsonb_typeof(b -> 'cost') from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'by_company') b
                where b ->> 'partner_id' = current_setting('t.a')), 'null', 'the organisation''s cost is empty too');
select test.eq((select jsonb_typeof(b -> 'profit') from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'by_company') b
                where b ->> 'partner_id' = current_setting('t.a')), 'null', 'and its profit');

-- one costed row at another organisation: the totals are the known costs; the uncosted organisation stays empty
select test.act(current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.b')::uuid, (select id from work.import_batch where partner_id = current_setting('t.b')::uuid), 'transaction', 'CST-B1', 'CST-B1-INV', current_setting('t.d')::date, 500, 500, 120, 380, true, current_setting('t.head')::uuid);
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ul', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'cost')::numeric, 120.00, 'once a cost is known the total is the known cost');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'profit')::numeric, 380.00, 'and the profit of the costed rows only');
select test.eq((select jsonb_typeof(b -> 'cost') from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'by_company') b
                where b ->> 'partner_id' = current_setting('t.a')), 'null', 'the organisation with no cost stays empty');
select test.eq((select (b ->> 'cost')::numeric from pg_catalog.jsonb_array_elements(current_setting('t.ul')::jsonb -> 'by_company') b
                where b ->> 'partner_id' = current_setting('t.b')), 120.00, 'the costed organisation shows its cost');
-- a cost of exactly 0 is a cost: shown as 0, not empty
select test.act(current_setting('t.head')::uuid);
update work.import_record set cost_sar = 0, profit_sar = 700 where transaction_ref = 'CST-A1';
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select (b ->> 'cost')::numeric from pg_catalog.jsonb_array_elements(
  api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) -> 'by_company') b
  where b ->> 'partner_id' = current_setting('t.a')), 0.00, 'a recorded cost of 0 is a cost, shown as 0');
