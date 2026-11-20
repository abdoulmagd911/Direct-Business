-- LST-01 — the exclusion list and the merge list apply to imported rows (Landing 32, A2). Excluding a client ID
-- excludes the rows of the organisation holding it — what was typed, nothing else: an organisation that also
-- holds a kept client ID keeps its rows. Merging a client ID counts its organisation's rows under the named
-- one; merging a code counts its rows under the named organisation and takes them out of the promo pool. The
-- list shows what each rule catches, the preview check answers for an organisation, and "Is it counted?" says
-- it by month. Admin only. Every value is made up; nothing here is a real client.
-- Sabotage: supabase/tests/sabotage/a-client-id-rule-skips-imported-rows.sql, a-merged-code-stays-in-the-pool.sql.
-- NOTHING IS SEEDED: a database built from the migrations alone holds an empty exclusion list and an empty merge
-- list. The owner types every entry himself in Settings → Finance.
select test.eq((select count(*)::int from finance.exclusion_rule), 0, 'the migrations seed no exclusion rule');
select test.eq((select count(*)::int from finance.merge_rule), 0, 'and no merge rule');
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin', 'commercial')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
create function pg_temp.org(p_name text) returns text language sql as
$$ select api.partner_create(jsonb_build_object('trade_name_en', p_name,
     'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id' $$;
grant execute on function pg_temp.org(text) to public;
select set_config('t.a', pg_temp.org('Made Up Excluded Org'), true);   -- holds 990201 (to exclude)
select set_config('t.b', pg_temp.org('Made Up Mixed Org'), true);      -- holds 990202 (to exclude) and 990203 (kept)
select set_config('t.c', pg_temp.org('Made Up Target Org'), true);     -- the merge target, holds 990204
select set_config('t.e', pg_temp.org('Made Up Second Half Org'), true); -- holds 990205, merged into the target
select set_config('t.f', pg_temp.org('Made Up Code Org'), true);       -- rows carrying the code MADEUPL32
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', '990201', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '990202', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '990203', 'made up', 'prepaid');
select api.identifier_add(current_setting('t.c')::uuid, 'payments_client_id', '990204', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.e')::uuid, 'payments_client_id', '990205', 'made up', 'postpaid');
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
select gen_random_uuid(), p::uuid, 'invoice_export', 'made-up-lst.csv', current_setting('t.head')::uuid
from unnest(array[current_setting('t.a'), current_setting('t.b'), current_setting('t.c'), current_setting('t.e'), current_setting('t.f')]) p;
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, source_promo, attribution_promo, created_by)
select v.p::uuid, (select b.id from work.import_batch b where b.partner_id = v.p::uuid), 'transaction', v.tx, v.inv,
       current_setting('t.d')::date, v.amt, v.amt, v.cost, v.amt - v.cost, true, v.promo, v.promo is not null,
       current_setting('t.head')::uuid
from (values (current_setting('t.a'), 'LST-A1', 'LST-A1-INV', 1000::numeric, 100::numeric, null::text),
             (current_setting('t.b'), 'LST-B1', 'LST-B1-INV', 2000, 200, null),
             (current_setting('t.c'), 'LST-C1', 'LST-C1-INV', 400, 40, null),
             (current_setting('t.e'), 'LST-E1', 'LST-E1-INV', 800, 80, null),
             (current_setting('t.f'), 'LST-F1', 'LST-F1-INV', 5000, 500, 'MADEUPL32')) v(p, tx, inv, amt, cost, promo);
select test.done();

create function pg_temp.ul(p_partner uuid default null) returns jsonb language sql as
$$ select api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, p_partner) $$;
create function pg_temp.co(p_partner text) returns jsonb language sql as
$$ select b from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'by_company') b where b ->> 'partner_id' = p_partner $$;
create function pg_temp.ov() returns jsonb language sql as
$$ select api.finance_period('2026-01-01'::date, '2026-12-31'::date) $$;
grant execute on function pg_temp.ul(uuid), pg_temp.co(text), pg_temp.ov() to public;

-- before any list: the four plain rows count (1000 + 2000 + 400 + 800); the code row is in the promo pool
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 4200.00, 'before: 4200 counts');
select test.eq((pg_temp.ul() -> 'totals' ->> 'promo_units')::int, 1, 'before: one row in the promo pool');
select test.eq((pg_temp.ov() ->> 'revenue')::numeric, 4200.00, 'the Overview says the same');

-- only an admin keeps the lists
select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.finance_merge_rules()$$, '42501', 'a head cannot read the merge list');
select test.raises(format('select api.finance_merge_rule_save(null, %L)',
  jsonb_build_object('kind', 'client_id', 'value', '990205', 'partner_id', current_setting('t.c'), 'reason', 'made up')::text),
  '42501', 'nor add to it');

-- EXCLUDE client IDs 990201 and 990202: A's row leaves; B's stays — B also holds 990203, which is kept
select test.as_person(current_setting('t.admin')::uuid);
select api.finance_exclusion_rule_save(null, '{"kind": "client_id", "value": "990201", "reason": "made up: not ours"}', null, 'made up');
select api.finance_exclusion_rule_save(null, '{"kind": "client_id", "value": "990202", "reason": "made up: not ours either"}', null, 'made up');
select test.eq((pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 3200.00, 'the excluded client''s imported row leaves the totals');
select test.eq((pg_temp.ul() -> 'totals' ->> 'excluded_revenue')::numeric, 1000.00, 'and is listed apart with its revenue');
select test.eq((select r ->> 'not_counted_reason' from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'rows') r where r ->> 'number' = 'LST-A1'),
  'made up: not ours', 'with the rule''s reason');
select test.eq((select r ->> 'counted' from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'rows') r where r ->> 'number' = 'LST-B1'),
  'true', 'an organisation that also holds a kept client ID keeps its rows: nothing is guessed');
select test.eq((pg_temp.ov() ->> 'revenue')::numeric, 3200.00, 'the Overview drops the same row');
select test.eq((select (e ->> 'imported_rows')::int from pg_catalog.jsonb_array_elements(api.finance_exclusion_rules()) e where e ->> 'value' = '990201'),
  1, 'the list shows the imported row the rule catches');
select test.eq((select (e ->> 'amount_sar')::numeric from pg_catalog.jsonb_array_elements(api.finance_exclusion_rules()) e where e ->> 'value' = '990201'),
  1000.00, 'and its riyals');
select test.eq((api.finance_import_rule_check(current_setting('t.a')::uuid) ->> 'excluded')::boolean, true,
  'the preview check says an import for the excluded organisation is caught');
select test.eq(api.finance_import_rule_check(current_setting('t.a')::uuid) ->> 'value', '990201', 'naming the rule');
select test.eq((api.finance_import_rule_check(current_setting('t.b')::uuid) ->> 'excluded')::boolean, false,
  'and not for the organisation that keeps an ID');

-- MERGE client ID 990205 into the target: E's row counts under the target; totals do not move
select set_config('t.m', api.finance_merge_rule_save(null,
  jsonb_build_object('kind', 'client_id', 'value', '990205', 'partner_id', current_setting('t.c'), 'reason', 'made up: one organisation'), null, 'made up') ->> 'id', true);
select test.eq((pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 3200.00, 'a merge moves no total');
select test.eq((pg_temp.co(current_setting('t.c')) ->> 'revenue')::numeric, 1200.00, 'the target counts both halves (400 + 800)');
select test.eq(pg_temp.co(current_setting('t.e')), null::jsonb, 'the merged organisation has no line of its own');
select test.eq((pg_temp.ul(current_setting('t.c')::uuid) -> 'totals' ->> 'revenue')::numeric, 1200.00,
  'asked for the target alone, the merged rows come with it');
select test.eq((pg_temp.ul(current_setting('t.e')::uuid) -> 'totals' ->> 'units')::int, 0,
  'asked for the merged organisation alone, its rows have left');
select test.eq((select (e ->> 'rows')::int from pg_catalog.jsonb_array_elements(api.finance_merge_rules()) e where e ->> 'value' = '990205'),
  1, 'the merge list shows the row it merges');
select test.raises(format('select api.finance_merge_rule_save(null, %L)',
  jsonb_build_object('kind', 'client_id', 'value', ' 990205 ', 'partner_id', current_setting('t.a'), 'reason', 'again')::text),
  '23505', 'the same value twice is refused', 'finance.merge_rule_exists');

-- MERGE the code into the target: its row leaves the promo pool and counts under the target
select api.finance_merge_rule_save(null,
  jsonb_build_object('kind', 'discount_code', 'value', 'MADEUPL32', 'partner_id', current_setting('t.c'), 'reason', 'made up: their code'), null, 'made up');
select test.eq((pg_temp.ul() -> 'totals' ->> 'promo_units')::int, 0, 'the merged code has left the promo pool');
select test.eq((pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 8200.00, 'and its row counts (3200 + 5000)');
select test.eq((pg_temp.co(current_setting('t.c')) ->> 'revenue')::numeric, 6200.00, 'under the organisation it was merged into');
select test.eq((pg_temp.ov() ->> 'revenue')::numeric, 8200.00, 'the Overview agrees');
select test.eq((select (api.finance_income_by_service('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric), 8200.00,
  'and By service');

-- "Is it counted?" for the month: counted 8200 in 4 units; not counted 1000 in 1 unit, excluded
select set_config('t.cm', (select m from pg_catalog.jsonb_array_elements(
  api.finance_counted_by_month('2026-01-01'::date, '2026-12-31'::date) -> 'months') m
  where m ->> 'month_on' = pg_catalog.date_trunc('month', current_setting('t.d')::date)::date::text)::text, true);
select test.eq((current_setting('t.cm')::jsonb ->> 'counted_revenue')::numeric, 8200.00, 'the month counts 8200');
select test.eq((current_setting('t.cm')::jsonb ->> 'counted_units')::int, 4, 'in four units');
select test.eq((current_setting('t.cm')::jsonb ->> 'excluded_revenue')::numeric, 1000.00, 'and 1000 is not counted: excluded');
select test.eq((current_setting('t.cm')::jsonb ->> 'not_counted_units')::int, 1, 'one unit');

-- removing the merges and the rules puts everything back
select api.finance_merge_rule_remove(current_setting('t.m')::uuid, 'made up: two organisations after all');
select test.eq((pg_temp.co(current_setting('t.e')) ->> 'revenue')::numeric, 800.00, 'unmerged, the organisation has its own line again');
