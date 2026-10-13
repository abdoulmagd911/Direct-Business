-- QA-116 — A head of department brings back no removed allowed email and no removed access override (V141, V97, V125;
-- the scenario catalogue's ACC-121): access and sign-in records are an admin's. A head who owns the removed records (their
-- own second email, their own page-level and capability overrides, all removed by an admin) is refused
-- restore.not_allowed; so is a former admin, now a head, who removed their own second email while still an admin — the
-- one case where the remover rule would otherwise let them (they may see it, as its owner, and they removed it); an admin
-- brings an override back. Written by the QA auditor because the catalogue found no head case (QA-60 asks it of a
-- former admin moved to a member, and there the refusal already comes from not seeing the record). Guards: passes on
-- v2/main today and goes red when core.restore's list of admin-only tables (core.person_email, core.person_auth,
-- core.person_page_level, core.person_capability, core.role_page_level, core.role_capability) is deleted.
-- Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.admin2', test.person('Test Second Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.head_role', (select id::text from core.role where key = 'head'), true);

-- an admin gives the head a second allowed email and two overrides, then takes all three away
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.e', api.person_email_add(current_setting('t.head')::uuid, 'test.qa116.h@example.test', false,
  'made up') ->> 'id', true);
select set_config('t.lv', api.access_set_person_level(current_setting('t.head')::uuid, 'clients', 'view',
  'made up: view only') ->> 'id', true);
select set_config('t.cap', api.access_set_person_capability(current_setting('t.head')::uuid, 'clients.merge', false,
  'made up: no merging') ->> 'id', true);
select api.person_email_remove(current_setting('t.e')::uuid, 'made up');
select api.access_clear_person_level(current_setting('t.head')::uuid, 'clients', 'made up: back to the role');
select api.access_clear_person_capability(current_setting('t.head')::uuid, 'clients.merge', 'made up: back to the role');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.restore(%L, %L, %L)', 'person_email', current_setting('t.e'), 'made up'),
  '42501', 'a head brings back no allowed email, not even their own', 'restore.not_allowed');
select test.raises(format('select api.restore(%L, %L, %L)', 'person_level', current_setting('t.lv'), 'made up'),
  '42501', 'nor an access override on a page', 'restore.not_allowed');
select test.raises(format('select api.restore(%L, %L, %L)', 'person_capability', current_setting('t.cap'), 'made up'),
  '42501', 'nor a capability override', 'restore.not_allowed');

-- a second admin removes their own second email, then is moved to head: having removed it does not let them restore it
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.e2', api.person_email_add(current_setting('t.admin2')::uuid, 'test.qa116.a2@example.test', false,
  'made up') ->> 'id', true);
select test.as_person(current_setting('t.admin2')::uuid);
select api.person_email_remove(current_setting('t.e2')::uuid, 'made up');
-- (moved by hand: on v2/main api.access_set_person_role refuses to give the head role while the seed still grants it a
-- retired capability — QA-56's finding)
select test.as_owner();
update core.person set role_id = current_setting('t.head_role')::uuid where id = current_setting('t.admin2')::uuid;
select test.as_person(current_setting('t.admin2')::uuid);
select test.ok(authz.can_see('person_email', current_setting('t.e2')::uuid), 'the former admin sees their own email');
select test.raises(format('select api.restore(%L, %L, %L)', 'person_email', current_setting('t.e2'), 'made up'),
  '42501', 'but, now a head, brings it back no more than any head, though they removed it', 'restore.not_allowed');
select test.as_owner();
select test.ok((select deleted_at is not null from core.person_email where id = current_setting('t.e2')::uuid),
  'the email stays removed');

-- an admin may
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(api.restore('person_level', current_setting('t.lv')::uuid, 'made up') ->> 'id' is not null,
  'an admin brings the override back');
