-- CTR-01 — a contract's status is computed from its dates, never stored (V56): Not started the day before it starts;
-- Active from its first day; Expires in N days from partner.contract_expiring_from_days before its end (30: the 31st
-- day before is still Active) through its last day (0 days); Expired the day after; open-ended stays Active. A
-- contract is saved with its terms before → after in one request, terms left out are removed, and one Undo restores
-- them; its end cannot come before its start; a viewer saves none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-contract-expires-a-day-early.sql.
select test.eq(partner.contract_state('2027-01-01', '2027-12-31', '2026-12-31') ->> 'status', 'not_started',
  'the day before it starts: Not started');
select test.eq(partner.contract_state('2027-01-01', '2027-12-31', '2027-01-01') ->> 'status', 'active',
  'its first day: Active');
select test.eq(partner.contract_state('2027-01-01', '2027-12-31', '2027-11-30') ->> 'status', 'active',
  '31 days before its end: still Active');
select test.eq(partner.contract_state('2027-01-01', '2027-12-31', '2027-12-01'),
  '{"status": "expiring", "days_left": 30}'::jsonb, '30 days before its end: Expires in 30 days');
select test.eq(partner.contract_state('2027-01-01', '2027-12-31', '2027-12-31'),
  '{"status": "expiring", "days_left": 0}'::jsonb, 'its last day: Expires in 0 days');
select test.eq(partner.contract_state('2027-01-01', '2027-12-31', '2028-01-01') ->> 'status', 'expired',
  'the day after: Expired');
select test.eq(partner.contract_state('2027-01-01', null, '2040-01-01') ->> 'status', 'active', 'open-ended stays Active');

select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Contracts Co", "roles": ["supplier"]}') ->> 'id', true);
select set_config('t.c', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object(
  'title', 'Made-up hotel agreement', 'start_on', core.riyadh_today() - 100, 'end_on', core.riyadh_today() + 10,
  'terms', '[{"term": "corporate_rate", "before": 10, "after": 15}, {"term": "free_cancellation", "before": 1, "after": 3}]'::jsonb))
  ->> 'id', true);
select set_config('t.list', api.contracts(current_setting('t.p')::uuid)::text, true);
select test.eq(current_setting('t.list')::jsonb -> 0 ->> 'status', 'expiring', 'the card shows its status today');
select test.eq((current_setting('t.list')::jsonb -> 0 ->> 'days_left')::int, 10, 'with its days left');
select test.eq(jsonb_array_length(current_setting('t.list')::jsonb -> 0 -> 'terms'), 2, 'and its terms');
select test.eq(current_setting('t.list')::jsonb -> 0 -> 'reminder_days_in_force', '[60, 30, 7]'::jsonb,
  'its reminders are the setting''s days');

select set_config('t.r', api.contract_save(current_setting('t.p')::uuid, current_setting('t.c')::uuid,
  '{"reminder_days": [14], "terms": [{"term": "corporate_rate", "before": 10, "after": 20}]}', 1) ->> 'request_id', true);
select set_config('t.list', api.contracts(current_setting('t.p')::uuid)::text, true);
select test.eq((select jsonb_agg(t ->> 'term') from jsonb_array_elements(current_setting('t.list')::jsonb -> 0 -> 'terms') t),
  '["corporate_rate"]'::jsonb, 'a term left out is removed');
select test.eq((current_setting('t.list')::jsonb -> 0 -> 'terms' -> 0 ->> 'after')::numeric, 20::numeric, 'a term kept is changed');
select test.eq(current_setting('t.list')::jsonb -> 0 -> 'reminder_days_in_force', '[14]'::jsonb, 'its own reminder days');
select api.undo(current_setting('t.r')::uuid);
select test.eq(jsonb_array_length(api.contracts(current_setting('t.p')::uuid) -> 0 -> 'terms'), 2,
  'one Undo restores the terms');

select test.raises(format('select api.contract_save(%L, null, %L)', current_setting('t.p'),
  '{"title": "Made up", "start_on": "2027-05-01", "end_on": "2027-04-01"}'), 'P0001', 'its end cannot come before its start',
  'contract.invalid');
select test.raises(format('select api.contract_save(%L, null, %L)', current_setting('t.p'),
  '{"title": "Made up", "start_on": "2027-05-01", "terms": [{"term": "free_lunches"}]}'), 'P0002',
  'a term must be on the list', 'contract.unknown_term');
select test.raises(format('select api.contract_save(%L, null, %L)', current_setting('t.p'), '{"start_on": "2027-05-01"}'),
  'P0001', 'a contract has a title', 'contract.invalid');

select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(jsonb_array_length(api.contracts(current_setting('t.p')::uuid)), 1, 'a viewer reads the contracts');
select test.raises(format('select api.contract_save(%L, null, %L)', current_setting('t.p'),
  '{"title": "Made up", "start_on": "2027-05-01"}'), '42501', 'but saves none', 'access.needs_level');
