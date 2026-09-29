-- ACC-02 — a capability (§5, §8): the admin role holds every one; else the person's override; else the role's
-- starting grant from the registry; else no. A switched-off person holds none; authz.can() and api.me() agree.
-- Sabotage: supabase/tests/sabotage/capabilities-ignore-overrides.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into core.person_capability (person_id, capability_key, granted, reason)
values (current_setting('t.am1')::uuid, 'tasks.assign', true, 'made up for a test'),
       (current_setting('t.head')::uuid, 'clients.merge', false, 'made up for a test');

select test.ok(authz.can_of(current_setting('t.admin')::uuid, 'org.sign_out'), 'an admin holds every capability');
select test.ok(authz.can_of(current_setting('t.mgr')::uuid, 'tasks.assign'), 'a manager starts able to assign tasks');
select test.ok(not authz.can_of(current_setting('t.mgr')::uuid, 'clients.merge'), 'a manager does not merge partners');
select test.ok(authz.can_of(current_setting('t.am1')::uuid, 'tasks.assign'), 'an override grants what the role does not');
select test.ok(not authz.can_of(current_setting('t.head')::uuid, 'clients.merge'),
  'an override takes back what the role gives');
select test.ok(not authz.can_of(current_setting('t.am1')::uuid, 'no.such.capability'), 'an unknown capability: no');
update core.person set can_sign_in = false where id = current_setting('t.mgr')::uuid;
select test.ok(not authz.can_of(current_setting('t.mgr')::uuid, 'tasks.assign'), 'a switched-off person holds none');

select test.as_person(current_setting('t.am1')::uuid);
select test.ok(authz.can('tasks.assign'), 'authz.can() answers for the signed-in person');
select set_config('t.me', api.me()::text, true);
select test.as_owner();
select test.eq(current_setting('t.me')::jsonb -> 'capabilities', '["tasks.assign"]'::jsonb,
  'api.me() lists exactly the capabilities held');
