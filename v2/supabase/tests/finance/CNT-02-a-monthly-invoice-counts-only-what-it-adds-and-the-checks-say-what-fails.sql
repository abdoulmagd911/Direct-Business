-- CNT-02 — the monthly invoice and the checks (V616, V611, V617): a billing invoice is never revenue, except what it
-- carries beyond its linked transactions — a unit of its own in its month, flagged "fee on monthly invoice"; a
-- shortfall is a failed check, never counted; the DPIN is checked against total − approved expenses within 1 SAR, a
-- DPIN of 100 % of the total on a non-commission unit says "expenses missing", and a DPIN on a unit not yet Ready is
-- listed. Every value is made up. Sabotages: supabase/tests/sabotage/a-monthly-invoice-counts-its-whole-total.sql,
-- a-monthly-invoice-excess-is-dropped.sql, a-dpin-of-the-whole-total-passes.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-21', 'consolidated_ref', 'BL-21', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400),
  jsonb_build_object('ref', 'TX-22', 'consolidated_ref', 'BL-21', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 600),
  jsonb_build_object('ref', 'BL-21', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'),
                     'total_sar', 1060, 'dpin', 'DP-21', 'dpin_total', 1060),
  jsonb_build_object('ref', 'TX-23', 'consolidated_ref', 'BL-22', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'BL-22', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900),
  jsonb_build_object('ref', 'SA-24', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'dpin', 'DP-24', 'dpin_total', 700),
  jsonb_build_object('ref', 'SA-25', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'dpin', 'DP-25', 'dpin_total', 600)), now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'SA-24', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 300, 'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'SA-25', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 300, 'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');

select test.as_owner();
select test.eq((select jsonb_object_agg(ref || ':' || unit_kind, revenue) from finance.money_row where counted),
  '{"TX-21:transaction": 400.00, "TX-22:transaction": 600.00, "BL-21:monthly_fee": 60.00, "TX-23:transaction": 1000.00,
    "SA-24:standalone": 1000.00, "SA-25:standalone": 1000.00}'::jsonb,
  'the transactions count; BL-21 adds 60 beyond them, a unit of its own; BL-22, short of its transaction, adds nothing');
select test.ok((select fee_on_monthly_invoice from finance.money_row where ref = 'BL-21'), 'flagged "fee on monthly invoice"');
select test.eq((select jsonb_object_agg(ref || ':' || check_key, amount_sar) from finance.check),
  '{"BL-21:fee_on_monthly_invoice": 60.00, "BL-21:expenses_missing": 1060.00, "BL-21:dpin_before_ready": null,
    "BL-22:billing_short": 100.00, "SA-25:dpin_differs": -100.00}'::jsonb,
  'the excess is flagged; a DPIN of the whole total says expenses missing, and it came before the units were Ready; the shortfall fails; SA-25''s DPIN is 100 off; SA-24 passes');
select test.eq((select dpin from finance.money_row where ref = 'SA-24'), 'DP-24', 'the DPIN beside the transaction number, two fields (V617)');
