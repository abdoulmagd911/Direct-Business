-- HLT-01 — Finance health and Not yet invoiced (spec §3.6; M48, M52, V414, V420, V424). Health lists, by reason with
-- the riyals at stake, what the latest import held, expenses whose invoice has since arrived ("drop the cost export
-- again"), units with no organisation or an unknown client ID, Provisional units and Losses; nothing at zero is listed.
-- Not yet invoiced counts the Ready (draft) and Pending units apart, never in revenue. Every value is made up.
-- Sabotage: supabase/tests/sabotage/health-leaves-losses-out.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month' + interval '9 days')::date::text, true);
select set_config('t.rows', jsonb_build_array(
  jsonb_build_object('ref', 'TX-7101', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 300, 'client_id', '70001'),
  jsonb_build_object('ref', 'TX-7102', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 200),
  jsonb_build_object('ref', 'TX-7103', 'status', 'Draft', 'created_on', current_setting('t.d'), 'total_sar', 150),
  jsonb_build_object('ref', 'TX-7104', 'status', 'Pending Payment', 'created_on', current_setting('t.d'), 'total_sar', 90),
  jsonb_build_object('ref', 'TX-7105', 'status', 'Made Up Word', 'created_on', current_setting('t.d'), 'total_sar', 40))::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', current_setting('t.rows')::jsonb, now() - interval '3 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-7101', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 400,
                     'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-7199', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 25,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '2 days');
-- the next invoices export (cumulative) brings the invoice the expense was waiting for
select api.finance_import('invoices', current_setting('t.rows')::jsonb || jsonb_build_array(
  jsonb_build_object('ref', 'TX-7199', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 60)), now() - interval '1 day');

select test.eq(api.finance_health(current_setting('t.d')::date, current_setting('t.d')::date),
  '[{"key": "drop_cost_export_again", "count": 1, "amount_sar": 25},
    {"key": "held_invoices_status_unknown", "count": 1, "amount_sar": 40},
    {"key": "losses", "count": 1, "amount_sar": -100},
    {"key": "no_organisation", "count": 2, "amount_sar": 260},
    {"key": "provisional", "count": 2, "amount_sar": 260},
    {"key": "unknown_client_id", "count": 1, "amount_sar": 300}]'::jsonb,
  'health lists what is held back or doubtful, each with its riyals; a Loss is counted; nothing at zero is listed');
select test.eq(api.finance_not_invoiced(current_setting('t.d')::date, current_setting('t.d')::date),
  '{"ready": {"units": 1, "amount_sar": 150}, "pending": {"units": 1, "amount_sar": 90}}'::jsonb,
  'Not yet invoiced: Ready and Pending apart');
select test.eq((api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) ->> 'revenue')::numeric, 560::numeric,
  'and never in revenue');
select test.raises($$select api.finance_health('2026-02-01', '2026-01-01')$$, 'P0001',
  'a period that ends before it starts is refused', 'common.invalid');
