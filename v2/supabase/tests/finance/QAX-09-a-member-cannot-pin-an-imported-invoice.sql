-- QA 2 repro: §3.5 level 0 — an entry pin is for "anyone who may type the invoice"; typing needs Full on Finance, so a
-- member cannot pin an imported invoice to an organisation.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (date_trunc('month', core.riyadh_today()::timestamp) - interval '1 month' + interval '3 days')::date::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-91Q', 'customer_name', 'Nobody Made Up', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100)),
  now() - interval '1 day');
select test.as_owner();
select set_config('t.inv', (select id from finance.invoice where ref = 'TX-91Q')::text, true);
select set_config('t.adm', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.adm')::uuid);
select set_config('t.org', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format($$select api.match_pin_set(%L, %L, 'entry', 'made up')$$, current_setting('t.inv'), current_setting('t.org')),
  '42501', 'a member cannot pin an imported invoice');
