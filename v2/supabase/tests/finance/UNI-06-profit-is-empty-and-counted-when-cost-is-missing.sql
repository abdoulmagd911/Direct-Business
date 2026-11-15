-- UNI-06 — a company whose invoices lack a cost shows profit empty and says how many invoices lack a cost
-- (Landing 25, F-A/A1; finding 3's profit rule). Profit is calculated only from invoices that have a cost, so
-- the ledger's rows carry no profit of their own for a cost-pending row and the without_cost count names how
-- many there are. The tab reads those two facts and shows profit empty — it must not overstate profit by
-- treating the missing cost as 0. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni6 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '88006', 'made up', 'postpaid');
-- one manual row only, fully paid, no expense at all: revenue 700, cost and profit empty
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-U4-N1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 700,
                     'client_id', '88006')),
  now() - interval '1 day');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.tab', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int, 1,
  'the company counts one unit');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric, 700.00,
  'the company revenue is 700');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'without_cost')::int, 1,
  'one row without cost — the count the tab shows beside the empty profit');
select test.eq((select (r ->> 'cost') is null from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'transaction_number' = 'TX-U4-N1'), true,
  'the cost-pending row carries no cost');
select test.eq((select (r ->> 'profit') is null from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'transaction_number' = 'TX-U4-N1'), true,
  'the cost-pending row carries no profit — profit is never guessed from a missing cost');
-- the tab's own profit sum (only rows that have a profit) is empty: no row has one, so there is nothing to sum
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'profit' is not null), 0,
  'no row has a profit, so the tab shows profit empty');
