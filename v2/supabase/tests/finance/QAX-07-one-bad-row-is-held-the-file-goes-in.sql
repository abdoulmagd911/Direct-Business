-- QA 2 repro: D21 — one bad row is held with its reason; the rest of the file is written.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
do $$ begin
  perform api.finance_import('invoices', jsonb_build_array(
    jsonb_build_object('ref', 'TX-71Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100),
    jsonb_build_object('ref', 'TX-72Q', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                       'branch', repeat('b', 200))),
    now() - interval '1 day');
  perform set_config('t.err', 'none', true);
exception when others then perform set_config('t.err', sqlerrm, true);
end $$;
select test.eq(current_setting('t.err'), 'none', 'a row with a 200-character branch does not stop the file');
select test.as_owner();
select test.ok(exists (select 1 from finance.invoice where ref = 'TX-71Q'), 'the good row is written');
