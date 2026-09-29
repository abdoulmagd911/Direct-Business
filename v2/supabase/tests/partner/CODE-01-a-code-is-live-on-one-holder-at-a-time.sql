-- CODE-01 — discount and campaign codes (V65, V135): a code is live on one partner or one campaign at a time, dates
-- included — the same code may pass from one to another in time; one live code per partner unless someone with
-- clients.assign says a second is meant; a code's terms name who approved them. Every code is made up.
-- Sabotage: supabase/tests/sabotage/a-campaign-code-and-a-partner-code-overlap.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.manager', test.person('Test Manager', 'manager')::text, true);
insert into core.person_capability (person_id, capability_key, granted, reason)
values (current_setting('t.manager')::uuid, 'clients.assign', false, 'made up: no second codes');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create('{"trade_name_en": "Made Up Delta", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.b', api.partner_create('{"trade_name_en": "Made Up Epsilon", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

select set_config('t.code', api.identifier_add(current_setting('t.a')::uuid, 'discount_code', 'MADEUP10', 'made up',
  null, '2027-01-01', '2027-06-30') ->> 'id', true);
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, null, %L, %L)', current_setting('t.b'), 'discount_code',
  'made-up-10', 'made up', '2027-06-01', '2027-12-31'), '23505', 'the same code on another partner for overlapping dates is refused',
  'identifier.held');
select test.ok((api.identifier_add(current_setting('t.b')::uuid, 'discount_code', 'made-up-10', 'made up: passed on', null,
  '2027-07-01', '2027-12-31') ->> 'id') is not null, 'after its dates it may pass to another partner');
select test.raises($$select api.campaign_code_add('MadeUp10', 'Made-up trial', '2027-03-01', '2027-03-31', null, 'made up')$$,
  '23505', 'a campaign cannot take a code a partner holds for those dates', 'identifier.held');
select api.campaign_code_add('TRIAL5', 'Made-up trial', '2027-03-01', '2027-03-31', null, 'made up: a short trial');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, null, %L, %L)', current_setting('t.b'), 'discount_code',
  'trial5', 'made up', '2027-03-15', '2027-04-15'), '23505',
  'a code live on a campaign is refused to a partner for the same dates', 'identifier.held');

select test.raises(format('select api.identifier_add(%L, %L, %L, %L, null, %L, %L)', current_setting('t.a'), 'discount_code',
  'SECOND20', 'made up', '2027-02-01', '2027-02-28'), 'P0001', 'one live code per partner', 'identifier.one_code_per_partner');
select test.as_person(current_setting('t.manager')::uuid);
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, null, %L, %L, null, true)', current_setting('t.a'),
  'discount_code', 'SECOND20', 'made up', '2027-02-01', '2027-02-28'), '42501',
  'a second one needs clients.assign', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select test.ok((api.identifier_add(current_setting('t.a')::uuid, 'discount_code', 'SECOND20', 'made up: a second is meant',
  null, '2027-02-01', '2027-02-28', null, true) ->> 'id') is not null, 'which says so');

select test.ok((api.code_terms_add(current_setting('t.code')::uuid, null, 5, current_setting('t.head')::uuid, '2026-12-20',
  '2027-01-01', '{}', '{SA}', '[{"from_bookings": 50, "fee_percent": 4}]') ->> 'id') is not null,
  'a code carries its terms, with who approved them');
select test.raises(format('select api.code_terms_add(%L, null, 5, null, %L, %L)', current_setting('t.code'), '2026-12-20',
  '2027-01-01'), '23502', 'the approver is required', null);
