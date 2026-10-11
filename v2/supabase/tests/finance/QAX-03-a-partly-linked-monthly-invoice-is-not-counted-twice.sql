-- QA 2 repro: V616 — a monthly invoice of 1,500 covering TX-31 (linked) and TX-32 (no consolidated ref in its row)
-- must not count 2,000 for 1,500 billed.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-31', 'consolidated_ref', 'BL-31', 'customer_name', 'Made Up Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'TX-32', 'customer_name', 'Made Up Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 500),
  jsonb_build_object('ref', 'BL-31', 'is_consolidated', true, 'customer_name', 'Made Up Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 1500)), now() - interval '1 day');
select test.as_owner();
select test.eq((select sum(revenue) from finance.money_row where counted), 1500.00::numeric,
  'counted revenue equals what was billed (1,500), not 2,000');
