-- QA-58 — Undo never reaches a record its author can no longer see (V128, V143): a member whose access to Clients is
-- taken away cannot take back their earlier change to a client, even inside the undo window. Written by the QA auditor
-- to fail until it is fixed: on v2/main at d78f58f audit.undo_allowed returns true for the actor's own change before it
-- asks authz.can_see_as, so the member rewrites a record the rest of the app no longer shows them (the oversight's
-- review of #93, item b).
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-58. Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.m', test.person('Test Member', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA58', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);

select test.as_person(current_setting('t.m')::uuid);
select set_config('t.r', api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note"}', 1, 'made up')
  ->> 'request_id', true);

select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.m')::uuid, 'clients', 'none', 'made up: moved away');

select test.as_person(current_setting('t.m')::uuid);
select test.ok(not authz.can_see('partner', current_setting('t.p')::uuid), 'the member no longer sees the client');
select test.raises(format('select api.undo(%L)', current_setting('t.r')), '42501',
  'and takes back no change to it');
select test.as_owner();
select test.eq((select notes from partner.partner where id = current_setting('t.p')::uuid), 'made up note',
  'the change stands');
