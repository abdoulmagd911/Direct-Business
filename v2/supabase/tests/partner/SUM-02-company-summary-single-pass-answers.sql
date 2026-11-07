-- SUM-02 — partner.company_summary after the fix23 single-pass restructure answers the same figures as the old
-- body (fix23 change 1: the finance flags folded into one money_row pass; change 2: each tender's approved_cost
-- computed once and reused; change 3: the codes block no longer re-evaluates the whole sales_by_code view).
--
-- How the comparison works: the migration replaces the function, so the old body is gone by the time this test
-- runs and cannot be called directly. Instead the EXPECTED figures are built here from the old logic itself,
-- copied verbatim from v2/supabase/migrations/20261105010000_company_summary_codes_group.sql lines 30-132
-- (same views — finance.money_row, finance.invoice_fact, finance.sales_by_code, finance.tender_use — same
-- filters, same coalesce, same null behaviour, including the tender approved_cost SUM evaluated three times),
-- and api.company_summary (the new function) must return exactly those figures, field by field. If any figure
-- differs, the test FAILS — a wrong fold must not silently change a figure. Literal pins on the expected
-- figures are asserted too, so a setup failure (a row that never imported, a tender never signed) fails loudly
-- instead of passing vacuously, because the comparison alone would still pass on equally wrong data.
--
-- Edge cases, all made up, on one partner P: a fully paid row with an approved cost (TX-S2-1, 1000/200/800,
-- carrying a DPIN so it is not waiting); a provisional row with no expense at all (TX-S2-2); a promo/code row
-- (TX-S2-3, SUM2CODE, approved cost 50); a row whose only expense is still Pending (TX-S2-4); an unpaid
-- Published row that must not leak into any figure (TX-S2-5); a SIGNED tender with a named client ID and
-- counted units on that ID (T1, awarded 900, consumed 2200); an APPLIED-only tender showing no money (T2).
-- Partner E proves the empty-cost rule (its only counted unit has no approved cost: cost and profit stay empty,
-- never 0). Partner N has no finance rows at all (all flags false, waiting_count 0, codes [], tenders [] — where
-- a wrong flag fold would show). No timing is asserted here; the performance evidence is the local scale
-- benchmark, not a CI timing assertion.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.reader', test.person('Test Reader', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 40)::text, true);
select set_config('t.d_hap', (current_setting('t.d')::date - 21)::text, true);
select set_config('t.d_awd', (current_setting('t.d')::date - 5)::text, true);
-- Before any as_person: as_person sets the role to authenticated, which has no direct write on the access tables,
-- so the overrides are placed while still owner. The reader may open a company (clients/view, SUM-01's gate)
-- and may see Finance (finance/view), so finance_visible is true and the money is shown, not nulled.
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.reader')::uuid, 'clients', 'view', 'made up for a test'),
       (current_setting('t.reader')::uuid, 'finance', 'view', 'made up for a test');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Sum Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select set_config('t.e', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Empty Cost Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select set_config('t.n', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up No Rows Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '88001', 'made up', 'tender');
select api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'SUM2CODE', 'made up', null,
                          core.riyadh_today() - 90, null);
select api.identifier_add(current_setting('t.e')::uuid, 'payments_client_id', '88002', 'made up', 'postpaid');
select test.as_owner();
select set_config('t.id1', (select id::text from partner.identifier where value_raw = '88001'), true);

-- T1 signed in the invoice month at 900 awarded; T2 only applied
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.T1', api.tender_save(null, jsonb_build_object('title', 'Made-up delegation travel', 'partner_id',
  current_setting('t.p'), 'source', 'tender_portal', 'value_sar', 1000, 'happened_on', current_setting('t.d_hap')))
  ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'awarded', current_setting('t.d_awd')::date,
                         '{"awarded_value_sar": 900}');
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'signed', current_setting('t.d')::date);
select set_config('t.T2', api.tender_save(null, jsonb_build_object('title', 'Made-up conference travel', 'partner_id',
  current_setting('t.p'), 'source', 'tender_portal', 'value_sar', 5000, 'happened_on', current_setting('t.d_hap')))
  ->> 'id', true);

-- naming the ID needs Full on Finance (the head, as in TND-01)
select test.as_person(current_setting('t.head')::uuid);
select api.finance_tender_client_id_set(current_setting('t.T1')::uuid, current_setting('t.id1')::uuid,
                                        'made up: the award letter names it');

-- P: TX-S2-1 fully paid with an approved cost and a DPIN (not waiting); TX-S2-2 provisional with no expense;
-- TX-S2-3 the promo row; TX-S2-4 provisional on a Pending expense; TX-S2-5 Published, never counted.
-- E: one fully paid row with no expense at all. A plain import row is standalone, so a DPIN is allowed on it
-- (finance.kind_allows: dpin on billing or standalone); its total, 800, is the total less the approved cost.
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-S2-1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'client_id', '88001', 'dpin', 'DPIN-S2-1', 'dpin_total', 800),
  jsonb_build_object('ref', 'TX-S2-2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'client_id', '88001'),
  jsonb_build_object('ref', 'TX-S2-3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
                     'client_id', '88001', 'discount_code', 'SUM2CODE'),
  jsonb_build_object('ref', 'TX-S2-4', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400,
                     'client_id', '88001'),
  jsonb_build_object('ref', 'TX-S2-5', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 999,
                     'client_id', '88001'),
  jsonb_build_object('ref', 'TX-S2-E1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 700,
                     'client_id', '88002')), now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-S2-1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 200,
                     'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-S2-3', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 50,
                     'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-S2-4', 'expense_type', 'Hotel', 'status', 'Pending', 'amount_sar', 100,
                     'created_at', '2026-01-01T11:00:00Z')), now() - interval '1 day');

-- The expected figures, from the OLD logic verbatim (20261105010000 lines 30-132), computed as the owner:
-- authenticated has no direct SELECT on the finance views, so this runs before the reader's calls.
select test.as_owner();
select set_config('t.exp', (
  select jsonb_object_agg(v.pid::text, jsonb_build_object(
    'partner_id', v.pid,
    'finance_visible', true,
    'wallet', (
      select jsonb_build_object(
        'topped_up', coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup'), 0),
        'wallet_spent', coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup'), 0),
        'invoiced_total', coalesce(sum(f.total_sar) filter (where f.kind <> 'wallet_topup'), 0),
        'balance', coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup'), 0)
                   - coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup'), 0),
        'held', null,
        'available', null)
      from finance.invoice_fact f where f.partner_id = v.pid and f.pay_state = 'paid'),
    'finance', (
      select jsonb_build_object(
        'units', count(*) filter (where r.counted),
        'revenue', coalesce(sum(r.revenue) filter (where r.counted), 0),
        'cost', sum(r.cost) filter (where r.counted and not r.provisional),
        'profit', case when sum(r.cost) filter (where r.counted and not r.provisional) is null then null
                        else coalesce(sum(r.revenue) filter (where r.counted), 0)
                             - sum(r.cost) filter (where r.counted and not r.provisional) end,
        'provisional_units', count(*) filter (where r.counted and r.provisional),
        'provisional_revenue', coalesce(sum(r.revenue) filter (where r.counted and r.provisional), 0),
        'cost_pending', exists (select 1 from finance.money_row x
                                where x.counted and x.partner_id = v.pid and x.provisional),
        'waiting_for_issuing', exists (select 1 from finance.money_row x
                                       join finance.invoice_fact f on f.id = x.invoice_id
                                       where x.counted and x.partner_id = v.pid and f.dpin is null),
        'waiting_count', (select count(distinct x.invoice_id) from finance.money_row x
                          join finance.invoice_fact f on f.id = x.invoice_id
                          where x.counted and x.partner_id = v.pid and f.dpin is null))
      from finance.money_row r where r.partner_id = v.pid),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', g.code, 'units', g.units, 'revenue', g.revenue, 'profit', g.profit)
               order by g.revenue desc)
      from (select s.code, sum(s.units) as units, sum(s.revenue) as revenue, sum(s.profit) as profit
            from finance.sales_by_code s where s.partner_id = v.pid
            group by s.code) g), '[]'::jsonb),
    'tenders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', u.tender_id, 'number', u.number, 'title', u.title,
               'state', case when u.signed_on is null then 'applied' else 'signed' end,
               'signed_on', u.signed_on, 'client_id_named', u.client_identifier_id is not null,
               'tender_amount', u.signed_value,
               'invoiced', case when u.signed_on is not null then u.consumed end,
               'remaining', case when u.signed_on is not null then greatest(u.signed_value - u.consumed, 0) end,
               'units', case when u.signed_on is not null then u.units end,
               'approved_cost', (select sum(r.cost) from finance.money_row r
                                 join finance.invoice i on i.id = r.invoice_id
                                 join partner.identifier d on d.id = u.client_identifier_id
                                   and d.deleted_at is null and d.value_key = i.client_id_key
                                 where r.counted and not r.provisional),
               'cost_pending', exists (select 1 from finance.money_row r
                                       join finance.invoice i on i.id = r.invoice_id
                                       join partner.identifier d on d.id = u.client_identifier_id
                                         and d.deleted_at is null and d.value_key = i.client_id_key
                                       where r.counted and r.provisional),
               'actual_profit', case when u.signed_on is null then null
                 when (select sum(r.cost) from finance.money_row r
                       join finance.invoice i on i.id = r.invoice_id
                       join partner.identifier d on d.id = u.client_identifier_id
                         and d.deleted_at is null and d.value_key = i.client_id_key
                       where r.counted and not r.provisional) is null then null
                 else u.consumed - (select sum(r.cost) from finance.money_row r
                                    join finance.invoice i on i.id = r.invoice_id
                                    join partner.identifier d on d.id = u.client_identifier_id
                                      and d.deleted_at is null and d.value_key = i.client_id_key
                                    where r.counted and not r.provisional) end,
               'expected_cost', null,
               'expected_profit', null)
               order by u.signed_on desc nulls last, u.number)
      from finance.tender_use u where u.partner_id = v.pid), '[]'::jsonb)))
  from (values (current_setting('t.p')::uuid),
               (current_setting('t.e')::uuid),
               (current_setting('t.n')::uuid)) v(pid)
)::text, true);

-- Literal pins on the expected figures: the setup really built the edge cases (a comparison alone would pass
-- on equally wrong data if a row had never imported or a tender had never signed).
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'units')::int, 4,
  'P: four counted units (the Published row is not one)');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'revenue')::numeric,
  2200::numeric, 'P: revenue 1000 + 500 + 300 + 400');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'cost')::numeric,
  250::numeric, 'P: cost is the approved 200 + 50 only — the Provisional rows add nothing');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'profit')::numeric,
  1950::numeric, 'P: profit 2200 - 250');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'provisional_units')::int, 2,
  'P: two Provisional units — no expense, and the Pending expense');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'provisional_revenue')
  ::numeric, 900::numeric, 'P: Provisional revenue 500 + 400');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'cost_pending')::boolean,
  'P: cost is still pending');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'waiting_for_issuing')
  ::boolean, 'P: tax invoices are still waiting to be issued');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance' ->> 'waiting_count')::int, 3,
  'P: three counted units carry no DPIN (TX-S2-1 has one)');
select test.eq(current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'codes',
  '[{"code": "SUM2CODE", "units": 1, "revenue": 300, "profit": 250}]'::jsonb,
  'P: the promo row is the one code entry, 300 revenue and 250 profit');
select test.eq((select jsonb_build_object('tender_amount', t -> 'tender_amount', 'invoiced', t -> 'invoiced',
                                          'remaining', t -> 'remaining', 'units', t -> 'units',
                                          'approved_cost', t -> 'approved_cost', 'cost_pending', t -> 'cost_pending',
                                          'actual_profit', t -> 'actual_profit')
                from jsonb_array_elements(current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'tenders') t
                where t ->> 'title' = 'Made-up delegation travel'),
  '{"tender_amount": 900, "invoiced": 2200, "remaining": 0, "units": 4, "approved_cost": 250, "cost_pending": true,
    "actual_profit": 1950}'::jsonb,
  'P: the signed tender — awarded 900, consumed 2200 by its own ID, approved cost 250 reused for its profit');
select test.eq((select jsonb_build_object('state', t -> 'state', 'tender_amount', t -> 'tender_amount',
                                          'invoiced', t -> 'invoiced', 'approved_cost', t -> 'approved_cost',
                                          'cost_pending', t -> 'cost_pending', 'actual_profit', t -> 'actual_profit')
                from jsonb_array_elements(current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'tenders') t
                where t ->> 'title' = 'Made-up conference travel'),
  '{"state": "applied", "tender_amount": null, "invoiced": null, "approved_cost": null, "cost_pending": false,
    "actual_profit": null}'::jsonb,
  'P: the Applied-only tender shows no money');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'finance' ->> 'units')::int, 1,
  'E: one counted unit');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'finance' -> 'cost') = 'null'::jsonb,
  'E: cost stays empty with no approved cost — never 0');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'finance' -> 'profit') = 'null'::jsonb,
  'E: profit stays empty with no approved cost — never 0');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'finance' ->> 'cost_pending')::boolean,
  'E: cost is still pending');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance' ->> 'units')::int, 0,
  'N: no counted units');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance' ->> 'revenue')::numeric,
  0::numeric, 'N: revenue 0, not empty');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance' -> 'cost') = 'null'::jsonb,
  'N: cost is empty with no rows — never 0');
select test.ok((current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance' -> 'profit') = 'null'::jsonb,
  'N: profit is empty with no rows');
select test.ok(not (current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance' ->> 'cost_pending')::boolean,
  'N: no cost pending with no rows');
select test.ok(not (current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance'
                ->> 'waiting_for_issuing')::boolean, 'N: nothing waiting with no rows');
select test.eq((current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance' ->> 'waiting_count')::int, 0,
  'N: waiting_count 0 with no rows');
select test.eq(current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'codes', '[]'::jsonb,
  'N: no codes with no rows');
select test.eq(current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'tenders', '[]'::jsonb,
  'N: no tenders with no rows');

-- Old vs new: the new function must answer the old figures, field by field, on all three partners.
select test.as_person(current_setting('t.reader')::uuid);
select set_config('t.got_p', api.company_summary(current_setting('t.p')::uuid)::text, true);
select set_config('t.got_e', api.company_summary(current_setting('t.e')::uuid)::text, true);
select set_config('t.got_n', api.company_summary(current_setting('t.n')::uuid)::text, true);
select test.eq(current_setting('t.got_p')::jsonb ->> 'partner_id', current_setting('t.p'),
  'P: the summary is for this company');
select test.eq(current_setting('t.got_p')::jsonb ->> 'finance_visible', 'true',
  'P: the reader sees Finance');
select test.eq(current_setting('t.got_p')::jsonb -> 'finance',
  current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'finance',
  'P: the single-pass finance block answers the old figures (units, revenue, cost, profit, flags, waiting count)');
select test.eq(current_setting('t.got_p')::jsonb -> 'codes',
  current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'codes',
  'P: the codes block answers the old figures');
select test.eq(current_setting('t.got_p')::jsonb -> 'tenders',
  current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'tenders',
  'P: the tenders block answers the old figures, including the reused approved_cost');
select test.eq(current_setting('t.got_p')::jsonb -> 'wallet',
  current_setting('t.exp')::jsonb -> current_setting('t.p') -> 'wallet',
  'P: the wallet block is unchanged');
select test.eq(current_setting('t.got_e')::jsonb -> 'finance',
  current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'finance',
  'E: the single-pass finance block keeps cost and profit empty with no approved cost');
select test.eq(current_setting('t.got_e')::jsonb -> 'codes',
  current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'codes',
  'E: no codes');
select test.eq(current_setting('t.got_e')::jsonb -> 'tenders',
  current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'tenders',
  'E: no tenders');
select test.eq(current_setting('t.got_e')::jsonb -> 'wallet',
  current_setting('t.exp')::jsonb -> current_setting('t.e') -> 'wallet',
  'E: the wallet block is unchanged');
select test.eq(current_setting('t.got_n')::jsonb -> 'finance',
  current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'finance',
  'N: the single-pass finance block answers the old figures on no rows (flags false, cost and profit empty)');
select test.eq(current_setting('t.got_n')::jsonb -> 'codes',
  current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'codes',
  'N: no codes');
select test.eq(current_setting('t.got_n')::jsonb -> 'tenders',
  current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'tenders',
  'N: no tenders');
select test.eq(current_setting('t.got_n')::jsonb -> 'wallet',
  current_setting('t.exp')::jsonb -> current_setting('t.n') -> 'wallet',
  'N: the wallet block is unchanged');
