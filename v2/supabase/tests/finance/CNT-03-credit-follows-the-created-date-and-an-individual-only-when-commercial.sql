-- CNT-03 — who is credited (V610, V613): a counted unit is credited to its organisation's account manager on its
-- created date — not today's; an individual's unit (no organisation) is credited to nobody until a person tags it
-- Commercial, which names the person (a one-share split, in the same request); another channel credits nobody; three
-- equal shares add up exactly to the halala. Every value is made up.
-- Sabotages: supabase/tests/sabotage/credit-follows-todays-account-manager.sql,
-- an-individual-is-credited-without-commercial.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager One', 'member')::text, true);
select set_config('t.am2', test.person('Test Account Manager Two', 'member')::text, true);
select set_config('t.am3', test.person('Test Account Manager Three', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 40)::text, true);

-- an organisation with a Payments client ID, its account manager am1 until 10 days ago, am2 since
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Credit Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '80001', 'made up', 'postpaid');
select test.as_owner();
update partner.side_owner set effective_from = core.riyadh_today() - 90, effective_to = core.riyadh_today() - 10
where partner_id = current_setting('t.p')::uuid and side = 'client';
insert into partner.side_owner (partner_id, side, person_id, effective_from, created_by)
values (current_setting('t.p')::uuid, 'client', current_setting('t.am2')::uuid, core.riyadh_today() - 10,
        current_setting('t.head')::uuid);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-31', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100, 'client_id', '80001'),
  jsonb_build_object('ref', 'TX-32', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 250,
                     'customer_name', 'Made Up Traveller'),
  jsonb_build_object('ref', 'TX-33', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                     'customer_name', 'Another Made Up Traveller')), now() - interval '1 day');

select test.as_owner();
select test.eq((select jsonb_object_agg(ref, coalesce(person_id::text, 'nobody')) from finance.credit_row),
  jsonb_build_object('TX-31', current_setting('t.am1'), 'TX-32', 'nobody', 'TX-33', 'nobody'),
  'the account manager on the created date, not today''s; the individuals credited to nobody');
select test.eq((select payment_type from finance.money_row where ref = 'TX-31'), 'postpaid', 'the payment type is the client ID''s kind (V87)');

-- Commercial names the person; Direct names nobody
select set_config('t.i32', (select id from finance.invoice where ref = 'TX-32')::text, true);
select set_config('t.i33', (select id from finance.invoice where ref = 'TX-33')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.finance_channel_set(current_setting('t.i32')::uuid, 'commercial')$$, 'P0001',
  'Commercial on an individual must name the person', 'finance.commercial_names_the_person');
select api.finance_channel_set(current_setting('t.i32')::uuid, 'commercial', current_setting('t.am3')::uuid, 'made up');
select api.finance_channel_set(current_setting('t.i33')::uuid, 'direct', current_setting('t.am3')::uuid, 'made up');
select test.as_owner();
select test.eq((select jsonb_object_agg(ref, coalesce(person_id::text, 'nobody')) from finance.credit_row where ref in ('TX-32', 'TX-33')),
  jsonb_build_object('TX-32', current_setting('t.am3'), 'TX-33', 'nobody'), 'tagged Commercial: credited; Direct: nobody');
select test.as_person(current_setting('t.head')::uuid);
select api.finance_channel_set(current_setting('t.i32')::uuid, 'promo', null, 'made up');
select test.as_owner();
select test.ok((select uncredited from finance.credit_row where ref = 'TX-32'), 'leaving Commercial takes the credit back');

-- three equal shares add up exactly
select test.act(current_setting('t.head')::uuid);
insert into finance.credit_split (invoice_id, person_id, share, note, created_by)
select i.id, s.pid, s.share, 'made up', current_setting('t.head')::uuid
from finance.invoice i, (values (current_setting('t.am1')::uuid, 0.333333), (current_setting('t.am2')::uuid, 0.333333),
                                (current_setting('t.am3')::uuid, 0.333334)) s(pid, share)
where i.ref = 'TX-31';
insert into finance.credit_split (invoice_id, person_id, share, note, created_by)
select i.id, current_setting('t.am1')::uuid, 1, 'made up', current_setting('t.head')::uuid from finance.invoice i where i.ref = 'TX-33';
select test.done();
select test.ok((select uncredited from finance.credit_row where ref = 'TX-33'),
  'a split typed on an individual''s unit tagged Direct still credits nobody (V613)');
select test.eq((select jsonb_build_object('people', count(*), 'revenue', sum(revenue)) from finance.credit_row where ref = 'TX-31'),
  '{"people": 3, "revenue": 100.00}'::jsonb, 'three shares of 100 add up to 100 exactly');
select test.eq((select array_agg(revenue order by revenue) from finance.credit_row where ref = 'TX-31'),
  array[33.33, 33.33, 33.34]::numeric[], 'the halala left over goes to one person, never lost');
