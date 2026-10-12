-- FAL-02 — no amount reaches a person below View on Finance (QA-539; V458). An account manager with Full on Clients and
-- no Finance access sees Needs a decision — each customer, its rows and clues — without the riyals at stake, and is not
-- sent the unpaid-invoice alert at all (it reaches only a person who can see the invoice); a manager with View on
-- Finance gets the alert with the amount owed, and a head sees the riyals in the queue. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-queue-shows-amounts-to-clients-only.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am')::uuid, 'finance', 'none', 'made up: no Finance access');
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Owing Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.p2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Second Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am2')))))
  ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '86001', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.p2')::uuid, 'payments_client_id', '86002', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 200
where person_id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8601', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 50)::text,
                     'total_sar', 300, 'client_id', '86001'),
  jsonb_build_object('ref', 'SA-8602', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 50)::text,
                     'total_sar', 200, 'client_id', '86002'),
  jsonb_build_object('ref', 'SA-8603', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 5)::text,
                     'total_sar', 90, 'client_id', '86999')), now() - interval '1 day');

select test.as_owner();
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification n
                where n.person_id = current_setting('t.am')::uuid and n.kind = 'alert_invoice_unpaid'),
  0, 'a manager without Finance is not sent the unpaid alert and its amount');
select test.eq((select (n.label_args ->> 'outstanding')::numeric from notify.notification n
                where n.person_id = current_setting('t.am2')::uuid and n.kind = 'alert_invoice_unpaid'),
  200::numeric, 'a manager with View on Finance gets the amount owed');

select test.as_person(current_setting('t.am')::uuid);
select test.eq((select jsonb_agg(jsonb_build_object('rows', g -> 'rows', 'amount', g -> 'amount_sar'))
                from jsonb_array_elements(api.match_queue()) g where g ->> 'value' = '86999'),
  '[{"rows": 1, "amount": null}]'::jsonb, 'Needs a decision shows the customer and its rows, not the riyals');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select (g ->> 'amount_sar')::numeric from jsonb_array_elements(api.match_queue()) g where g ->> 'value' = '86999'),
  90::numeric, 'View on Finance sees the riyals at stake');
