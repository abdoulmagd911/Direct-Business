-- QA-59 — A daily alert never reaches someone who can no longer see its record (V61, V96, V143): a follower of a
-- client whose access to Clients is taken away gets no contract-expiring alert, while a follower who kept access does.
-- Written by the QA auditor to fail until it is fixed: on v2/main at d78f58f notify.generate_alerts asks only
-- notify.may_notify, never authz.can_see_as, so the alert (with the contract's title, end date and the organisation's
-- number) still reaches the old follower (the oversight's review of #93, item b). notify.push and notify.fan_out ask it.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-59. Made-up values only (V101 shapes).
select set_config('v2.test_now', now()::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.f1', test.person('Test Old Follower', 'member')::text, true);
select set_config('t.f2', test.person('Test Follower', 'member')::text, true);
select set_config('t.d0', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA59', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.admin')))))
  ->> 'id', true);
select set_config('t.c', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up QA59', 'start_on', current_setting('t.d0')::date - 300,
  'end_on', current_setting('t.d0')::date + 30)) ->> 'id', true);
select test.as_person(current_setting('t.f1')::uuid);
select api.follow('partner', current_setting('t.p')::uuid, true);
select test.as_person(current_setting('t.f2')::uuid);
select api.follow('partner', current_setting('t.p')::uuid, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.f1')::uuid, 'clients', 'none', 'made up: moved away');

select test.as_owner();
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_contract_expiring'
                and person_id = current_setting('t.f2')::uuid and entity_id = current_setting('t.c')::uuid), 1,
  'a follower who still sees the client is told the contract is expiring');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.f1')::uuid
                and kind like 'alert\_%'), 0,
  'a follower who can no longer see it is told nothing');
