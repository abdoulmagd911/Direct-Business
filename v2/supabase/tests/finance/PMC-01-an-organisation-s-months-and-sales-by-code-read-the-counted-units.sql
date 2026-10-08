-- PMC-01 — an organisation's money by month and sales by code (§3.6 partner_month, sales_by_code; V65, V414, V611).
-- The card's month counts the organisation's paid units — revenue, cost, profit, with the Provisional part beside them
-- (never left out) and the Loss counted. Sales by code lists each code's month with whom it belonged to on the unit's
-- day — an organisation, a campaign (credited to no organisation), or nobody known — and the fee in force. Every value
-- is made up.
-- Sabotage: supabase/tests/sabotage/the-organisation-card-leaves-provisional-out.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 40)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Code Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '82001', 'made up', 'postpaid');
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'MADEUP20', 'made up', null,
                                               core.riyadh_today() - 90, null) ->> 'id', true);
select set_config('t.camp', api.campaign_code_add('TRIAL7', 'Made-up trial', core.riyadh_today() - 60, core.riyadh_today() - 20,
                                                  null, 'made up: a short trial') ->> 'id', true);
select api.code_terms_add(current_setting('t.code')::uuid, null, 10, current_setting('t.head')::uuid,
                          core.riyadh_today() - 90, core.riyadh_today() - 90);
select api.code_terms_add(current_setting('t.code')::uuid, null, 12, current_setting('t.head')::uuid,
                          core.riyadh_today(), core.riyadh_today());

select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-51', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300,
                     'client_id', '82001', 'discount_code', 'MADEUP20'),
  jsonb_build_object('ref', 'TX-52', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                     'customer_name', 'Made Up Traveller', 'discount_code', 'trial7'),
  jsonb_build_object('ref', 'TX-53', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 40,
                     'customer_name', 'Another Made Up Traveller', 'discount_code', 'NOBODY9'),
  jsonb_build_object('ref', 'TX-54', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200,
                     'client_id', '82001'),
  jsonb_build_object('ref', 'TX-55', 'status', 'Pending Payment', 'created_on', current_setting('t.d'), 'total_sar', 999,
                     'client_id', '82001')), now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-54', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 250,
                     'created_at', '2026-01-01T10:00:00Z')), now() - interval '1 day');

select test.eq(api.finance_partner_months(current_setting('t.p')::uuid),
  jsonb_build_array(jsonb_build_object('month_on', pg_catalog.date_trunc('month', current_setting('t.d')::timestamp)::date,
    'units', 2, 'revenue', 500, 'cost', 250, 'profit', 250, 'provisional_units', 1, 'provisional_revenue', 300, 'losses', 1)),
  'the organisation''s month: its paid units, the Provisional part beside them, the Loss counted, the unpaid one left out');
select test.eq((select jsonb_agg(jsonb_build_object('code', e ->> 'code', 'held_by', e ->> 'held_by',
                                                    'name', coalesce(e ->> 'partner_name', e ->> 'campaign_name'),
                                                    'units', (e ->> 'units')::int, 'revenue', (e ->> 'revenue')::numeric,
                                                    'fee_percent', (e ->> 'fee_percent')::numeric))
                from jsonb_array_elements(api.finance_sales_by_code(current_setting('t.d')::date, current_setting('t.d')::date)) e),
  '[{"code": "MADEUP20", "held_by": "partner", "name": "Made Up Code Co", "units": 1, "revenue": 300, "fee_percent": 10},
    {"code": "NOBODY9", "held_by": "unknown", "name": null, "units": 1, "revenue": 40, "fee_percent": null},
    {"code": "trial7", "held_by": "campaign", "name": "Made-up trial", "units": 1, "revenue": 100, "fee_percent": null}]'::jsonb,
  'sales by code: each code with whom it belonged to that day and the fee then in force; a campaign is listed apart');
select test.raises($$select api.finance_sales_by_code('2026-02-01', '2026-01-01')$$, 'P0001',
  'a period that ends before it starts is refused', 'common.invalid');
