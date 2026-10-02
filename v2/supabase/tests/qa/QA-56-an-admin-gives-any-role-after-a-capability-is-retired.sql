-- QA-56 — An admin gives any role, and adds a person with any role, even after a capability has been retired (V97,
-- V123, V146). Written by the QA auditor to fail until it is fixed: on v2/main at d78f58f the registry sync of #94
-- retired partners.assign, partners.identify and partners.merge but left the roles' grants of them, and the role check
-- asks authz.can_of(me, …) of every granted row, which is false for a retired capability even for an admin. So an admin
-- can make nobody a head or a manager (access.above_your_level {"capability": "partners.assign"}).
-- A made-up capability, granted to the head role and then retired, stands in for any later rename.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-56. Made-up people only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.x', test.person('Test Member', 'member')::text, true);
select set_config('t.y', test.person('Test Second Member', 'member')::text, true);
select set_config('t.dep', test.department()::text, true);
select set_config('t.head_role', (select id::text from core.role where key = 'head'), true);
select set_config('t.mgr_role', (select id::text from core.role where key = 'manager'), true);
insert into core.capability (key, page_key, active, created_by)
values ('clients.made_up_qa56', 'clients', true, current_setting('t.admin')::uuid);
insert into core.role_capability (role_id, capability_key, granted, created_by)
values (current_setting('t.head_role')::uuid, 'clients.made_up_qa56', true, current_setting('t.admin')::uuid);
update core.capability set active = false where key = 'clients.made_up_qa56';

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.x'),
  current_setting('t.head_role'), 'made up'), '42501', 'a head still gives nobody a role');

select test.as_person(current_setting('t.admin')::uuid);
select test.ok(api.access_set_person_role(current_setting('t.x')::uuid, current_setting('t.head_role')::uuid,
  'made up: promoted') ->> 'id' is not null, 'an admin makes a member a head');
select test.ok(api.access_set_person_role(current_setting('t.y')::uuid, current_setting('t.mgr_role')::uuid,
  'made up: promoted') ->> 'id' is not null, 'and another a manager');
select test.ok(api.person_create(jsonb_build_object('full_name_en', 'Test New Head', 'department_id',
  current_setting('t.dep'), 'role_id', current_setting('t.head_role'), 'can_sign_in', true), 'made up: joins')
  ->> 'id' is not null, 'and adds a new person as a head');
select test.as_owner();
select test.eq((select r.key from core.person p join core.role r on r.id = p.role_id
                where p.id = current_setting('t.x')::uuid), 'head', 'the member is now a head');
