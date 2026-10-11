-- QA 2 repro (round 2): V616 — BL-A1 (1,500) links TX-A1 (1,000). The customer has two unlinked bookings of 500 each,
-- so two sets add up and no proposal is made. Nothing billed may be counted twice: counted revenue stays at most what
-- was billed plus the bookings that are not inside it.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-A1', 'consolidated_ref', 'BL-A1', 'customer_name', 'Made Up Ambiguous Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'TX-A2', 'customer_name', 'Made Up Ambiguous Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 500),
  jsonb_build_object('ref', 'TX-A3', 'customer_name', 'Made Up Ambiguous Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 500),
  jsonb_build_object('ref', 'BL-A1', 'is_consolidated', true, 'customer_name', 'Made Up Ambiguous Co', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 1500)), now() - interval '1 day');
select test.as_owner();
-- billed 1,500 covers TX-A1 and one of the 500s; the other 500 is a booking of its own: 2,000 is the most that may count
select test.ok((select sum(revenue) from finance.money_row where counted) <= 2000.00,
  'with two sets that add up and no proposal, the monthly invoice''s 500 is not counted on top of both bookings (got ' ||
  (select sum(revenue) from finance.money_row where counted)::text || ')');
