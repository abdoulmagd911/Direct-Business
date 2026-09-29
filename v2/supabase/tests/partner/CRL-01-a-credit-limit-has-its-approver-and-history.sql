-- CRL-01 — credit limits (V70, V92, V136): finance.credit_control sets a partner's limit from a date, with who approved
-- it and why; 0 is "Prepaid only" and needs its approver like any other; the history stays; the card shows it only to
-- those with Finance · View. Amounts are made up.
-- Sabotage: supabase/tests/sabotage/anyone-sets-a-credit-limit.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am2')::uuid, 'finance', 'none', 'made up: no finance');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create('{"trade_name_en": "Made Up Zeta", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.credit_limit_set(%L, 50000, null, %L, %L)', current_setting('t.a'),
  current_setting('t.head'), 'made up'), '42501', 'a member without credit control cannot set a limit', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.credit_limit_set(%L, 50000, null, null, %L)', current_setting('t.a'), 'made up'), 'P0001',
  'the approver is required', 'credit.approver_required');
select test.raises(format('select api.credit_limit_set(%L, 50000, null, %L, null)', current_setting('t.a'),
  current_setting('t.head')), 'P0001', 'and the reason', 'common.reason_required');
select api.credit_limit_set(current_setting('t.a')::uuid, 50000, core.riyadh_today() - 60, current_setting('t.head')::uuid,
  'made up: first limit');
select api.credit_limit_set(current_setting('t.a')::uuid, 0, core.riyadh_today(), current_setting('t.head')::uuid,
  'made up: late payments');
select set_config('t.limits', (api.partner(current_setting('t.a')::uuid) -> 'credit_limits')::text, true);
select test.eq(jsonb_array_length(current_setting('t.limits')::jsonb), 2, 'the history stays');
select test.eq((current_setting('t.limits')::jsonb -> 0 ->> 'prepaid_only')::boolean, true, 'a limit of 0 is Prepaid only');

select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.partner(current_setting('t.a')::uuid) -> 'credit_limits', 'null'::jsonb,
  'a person without Finance does not see credit limits on the card');
