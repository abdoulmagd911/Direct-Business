-- FLOW-03 — splitting a unit's credit (PRF-121; §3.6 credit_split, §8 finance.credit). A member without finance.credit
-- is refused; a head splits a unit 50/50 between two people with a note, and each is credited half its revenue; shares
-- that do not add up to 1 are refused; one Undo puts the account manager back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-credit-split-need-not-add-up.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.two', test.person('Test Colleague', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 8)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Shared Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '92001', 'made up', 'postpaid');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-S1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 800,
                     'client_id', '92001')), now() - interval '1 day');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 90 where person_id = current_setting('t.am')::uuid;
select set_config('t.i', (select id::text from finance.invoice where ref = 'TX-S1'), true);
select set_config('t.split', jsonb_build_array(jsonb_build_object('person_id', current_setting('t.am'), 'share', 0.5),
                                               jsonb_build_object('person_id', current_setting('t.two'), 'share', 0.5))::text, true);

select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.finance_credit_split_set(%L, %L, %L)', current_setting('t.i'), current_setting('t.split'),
                          'made up: shared'), '42501', 'a member without finance.credit is refused');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.finance_credit_split_set(%L, %L, %L)', current_setting('t.i'),
                          jsonb_build_array(jsonb_build_object('person_id', current_setting('t.am'), 'share', 0.6),
                                            jsonb_build_object('person_id', current_setting('t.two'), 'share', 0.6)),
                          'made up: too much'), 'P0001', 'shares that do not add up to 1 are refused',
                   'finance.credit_shares_sum');
select set_config('t.req', api.finance_credit_split_set(current_setting('t.i')::uuid, current_setting('t.split')::jsonb,
                                                        'made up: they closed it together') ->> 'request_id', true);
select test.as_owner();
select test.eq((select jsonb_object_agg(c.person_id, c.revenue) from finance.credit_row c where c.invoice_id = current_setting('t.i')::uuid),
  jsonb_build_object(current_setting('t.am'), 400, current_setting('t.two'), 400), 'each is credited half its revenue');

select test.as_person(current_setting('t.head')::uuid);
select api.undo(current_setting('t.req')::uuid);
select test.as_owner();
select test.eq((select jsonb_object_agg(c.person_id, c.revenue) from finance.credit_row c where c.invoice_id = current_setting('t.i')::uuid),
  jsonb_build_object(current_setting('t.am'), 800), 'one Undo puts the account manager back');
