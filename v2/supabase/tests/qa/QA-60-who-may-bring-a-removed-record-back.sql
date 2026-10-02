-- QA-60 — Who may bring a removed record back (V141, V401, V97): the person who removed it; someone with Full on its
-- page; its owner with Own; nobody else — and an access record (an allowed email) only an admin, even the admin who
-- removed it once they are no longer one. Written by the QA auditor because no test asked: on v2/main at d78f58f
-- deleting any one of core.restore's four paths (the remover, Full, the owner, the admin-only access tables) left
-- the whole suite green. This test passes today and goes red when any of the first three is deleted.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-60. Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.admin2', test.person('Test Second Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.own', test.person('Test Owner', 'member')::text, true);
select set_config('t.m', test.person('Test Member', 'member')::text, true);
select set_config('t.x', test.person('Test Staff', 'member')::text, true);
select set_config('t.member_role', (select id::text from core.role where key = 'member'), true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA60', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.own')))))
  ->> 'id', true);
select test.as_person(current_setting('t.m')::uuid);
select set_config('t.c1', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Test Contact One"}')
  ->> 'id', true);
select set_config('t.c2', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Test Contact Two"}')
  ->> 'id', true);
select set_config('t.c3', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Test Contact Three"}')
  ->> 'id', true);
select api.contacts_remove(array[current_setting('t.c1')::uuid], 'made up');
select test.as_person(current_setting('t.admin')::uuid);
select api.contacts_remove(array[current_setting('t.c2')::uuid, current_setting('t.c3')::uuid], 'made up');
select api.access_set_person_level(current_setting('t.m')::uuid, 'clients', 'own', 'made up: own only');
select api.access_set_person_level(current_setting('t.own')::uuid, 'clients', 'own', 'made up: own only');

select test.as_person(current_setting('t.m')::uuid);
select test.raises(format('select api.restore(%L, %L, %L)', 'contact', current_setting('t.c2'), 'made up'), '42501',
  'with Own, neither its owner nor its remover brings nothing back', 'restore.not_allowed');
select test.ok(api.restore('contact', current_setting('t.c1')::uuid, 'made up') ->> 'id' is not null,
  'the person who removed a record brings it back, with Own and not its owner');
select test.as_person(current_setting('t.own')::uuid);
select test.ok(api.restore('contact', current_setting('t.c2')::uuid, 'made up') ->> 'id' is not null,
  'its owner brings it back with Own');
select test.as_person(current_setting('t.head')::uuid);
select test.ok(api.restore('contact', current_setting('t.c3')::uuid, 'made up') ->> 'id' is not null,
  'someone with Full on its page brings it back');

select test.as_person(current_setting('t.admin2')::uuid);
select api.person_email_add(current_setting('t.x')::uuid, 'test.qa60@example.test', false, 'made up');
select test.as_owner();
select set_config('t.e', (select id::text from core.person_email where email = 'test.qa60@example.test'), true);
select test.as_person(current_setting('t.admin2')::uuid);
select api.person_email_remove(current_setting('t.e')::uuid, 'made up');
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_role(current_setting('t.admin2')::uuid, current_setting('t.member_role')::uuid,
  'made up: moved to a member');
select test.as_person(current_setting('t.admin2')::uuid);
select test.raises(format('select api.restore(%L, %L, %L)', 'person_email', current_setting('t.e'), 'made up'),
  '42501', 'an allowed email comes back only by an admin, even to the one who removed it');
