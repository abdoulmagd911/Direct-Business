-- CLC-01 — one official client count (V477): sign-ups are the organisations with the Client side on; onboarded, those
-- whose side reached Active; active, those with a counted invoice in the last 90 days. By segment, in all, and as the
-- measure partner.active_clients for a person's clients. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-old-invoice-keeps-a-client-active.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.base', api.partner_client_counts()::text, true);
select set_config('t.a', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Active Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.b', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Lapsed Ministry',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.c', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Prospect Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.partner_status_set(current_setting('t.a')::uuid, 'client', 'active');
select api.partner_status_set(current_setting('t.b')::uuid, 'client', 'active');
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', '86001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.b')::uuid, 'payments_client_id', '86002', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 200 where person_id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8601', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 30)::text,
                     'total_sar', 100, 'client_id', '86001'),
  jsonb_build_object('ref', 'SA-8602', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 120)::text,
                     'total_sar', 100, 'client_id', '86002')), now() - interval '1 day');

select set_config('t.now', api.partner_client_counts()::text, true);
select test.eq(jsonb_build_object(
  'sign_ups', (current_setting('t.now')::jsonb ->> 'sign_ups')::int - (current_setting('t.base')::jsonb ->> 'sign_ups')::int,
  'onboarded', (current_setting('t.now')::jsonb ->> 'onboarded')::int - (current_setting('t.base')::jsonb ->> 'onboarded')::int,
  'active', (current_setting('t.now')::jsonb ->> 'active')::int - (current_setting('t.base')::jsonb ->> 'active')::int),
  '{"sign_ups": 3, "onboarded": 2, "active": 1}'::jsonb,
  'three sign-ups, two onboarded, one active: an invoice 120 days old does not keep a client active');

select test.as_owner();
select test.eq((select jsonb_object_agg(k, (measure.partner_active_clients(jsonb_build_object('count', k), 'person',
                  current_setting('t.am')::uuid, current_setting('t.t')::date, current_setting('t.t')::date)).value)
                from unnest(array['sign_ups', 'onboarded', 'active']) k),
  '{"sign_ups": 2, "onboarded": 2, "active": 1}'::jsonb, 'the measure, for the account manager''s clients');
select test.eq((measure.partner_active_clients('{"count": "sign_ups", "segment": "government"}', 'person',
                  current_setting('t.am')::uuid, current_setting('t.t')::date, current_setting('t.t')::date)).value,
  1::numeric, 'and by segment');
select test.raises($$select measure.partner_active_clients('{"count": "visitors"}', 'company', null, '2026-01-01', '2026-01-31')$$,
  'P0001', 'an unknown count is refused', 'measure.unknown_param');
