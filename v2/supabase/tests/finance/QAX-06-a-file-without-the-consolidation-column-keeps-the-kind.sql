-- QA 2 repro: D21 / V616 — a newer file without the consolidation columns (the seeded map has none) neither flips a
-- monthly invoice to standalone nor fails the import.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-61Q', 'consolidated_ref', 'BL-61Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'BL-61Q', 'is_consolidated', true, 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000)),
  now() - interval '3 days');
do $$ begin
  perform api.finance_import('invoices', jsonb_build_array(
    jsonb_build_object('ref', 'BL-61Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
    jsonb_build_object('ref', 'TX-61Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000)),
    now() - interval '1 day');
  perform set_config('t.err', 'none', true);
exception when others then perform set_config('t.err', sqlerrm, true);
end $$;
select test.eq(current_setting('t.err'), 'none', 'the newer file imports');
select test.as_owner();
select test.eq((select kind from finance.invoice where ref = 'BL-61Q'), 'billing', 'BL-61Q is still a monthly invoice');
select test.eq((select sum(revenue) from finance.money_row where counted), 1000.00::numeric, 'and 1,000 is counted once');
