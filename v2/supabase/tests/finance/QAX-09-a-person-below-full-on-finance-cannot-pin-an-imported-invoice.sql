-- QA 2 repro: §3.5 level 0 — an entry pin is for "anyone who may type the invoice"; typing needs Full on Finance, so a
-- person below Full cannot pin an imported invoice to an organisation. (Landing 34b, the owner, 21 Nov 2026: a Team
-- member starts at Full on Finance now, so the person below Full here is a Viewer — View on Finance; MPN-01 holds a
-- member at Own for the same rule.) Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.eq(authz.level_of(current_setting('t.viewer')::uuid, 'finance'), 'view', 'the viewer is at View on Finance');
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
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format($$select api.match_pin_set(%L, %L, 'entry', 'made up')$$, current_setting('t.inv'), current_setting('t.org')),
  '42501', 'View on Finance cannot pin an imported invoice', 'access.needs_level');
