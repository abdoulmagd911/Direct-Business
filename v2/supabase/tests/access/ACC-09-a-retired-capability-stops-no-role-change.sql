-- ACC-09 — a retired capability grants nothing, so it stops nothing (V176; the production bug of 29 Sep):
-- partners.assign, partners.identify and partners.merge gave way to each side's own (V98), and the grants they left on
-- the roles made every admin's "make this person a head / a manager" fail, "You cannot grant more than you have".
-- The grants of a retired capability are gone; an admin makes anyone a head or a manager; and one retired later —
-- while its grants are still on a role or a person — stops neither a role change nor clearing an override. Made up.
-- Sabotages: supabase/tests/sabotage/a-retired-capability-blocks-a-role.sql,
--            supabase/tests/sabotage/a-retired-capability-blocks-a-grant.sql,
--            supabase/tests/sabotage/the-retired-grants-stay-live.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.am3', test.person('Test Third Manager', 'member')::text, true);
select set_config('t.r_head', (select id::text from core.role where key = 'head'), true);
select set_config('t.r_manager', (select id::text from core.role where key = 'manager'), true);

-- the grants the retired partners.* capabilities left are gone, on roles and on people, and say why
select test.ok(exists (select 1 from core.capability where key like 'partners.%' and not active),
  'the partners capabilities are retired');
select test.eq((select count(*)::int from core.role_capability c join core.capability k on k.key = c.capability_key
                where not k.active and c.deleted_at is null)
             + (select count(*)::int from core.person_capability c join core.capability k on k.key = c.capability_key
                where not k.active and c.deleted_at is null), 0,
  'no role and no person holds a live grant of a retired capability');
select test.ok(exists (select 1 from core.role_capability c join core.role r on r.id = c.role_id
                       where r.key = 'head' and c.capability_key like 'partners.%'
                         and c.delete_reason = 'V176: the capability is retired'),
  'the head''s old grants are kept as history, removed with a reason');

-- an admin makes a team member a head, and another a manager
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am1'),
  current_setting('t.r_head'), 'made up: promoted'), 'an admin makes a team member a head');
select test.runs(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am2'),
  current_setting('t.r_manager'), 'made up: promoted'), 'and another a manager');
select test.as_owner();
select test.eq((select string_agg(r.key, ', ' order by r.key) from core.person p join core.role r on r.id = p.role_id
                where p.id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid)), 'head, manager',
  'both hold their new role');

-- a capability retired later, its grants still in place, stops nothing either
insert into core.capability (key, page_key) values ('made_up.power', 'tasks');
insert into core.role_capability (role_id, capability_key, granted)
select r.id, 'made_up.power', true from core.role r where r.key in ('head', 'member');
insert into core.person_capability (person_id, capability_key, granted, reason)
values (current_setting('t.am3')::uuid, 'made_up.power', false, 'made up for a test');
update core.capability set active = false where key = 'made_up.power';
select test.ok(not authz.can_of(current_setting('t.admin')::uuid, 'made_up.power'),
  'a retired capability is held by no one, an admin included');
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.access_clear_person_capability(%L, %L, %L)', current_setting('t.am3'),
  'made_up.power', 'made up: tidied'), 'an admin clears an override on a capability retired since');
select test.runs(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am3'),
  current_setting('t.r_head'), 'made up: promoted'), 'and makes a head of a role still carrying its grant');
select test.as_owner();
select test.eq((select r.key from core.person p join core.role r on r.id = p.role_id
                where p.id = current_setting('t.am3')::uuid), 'head', 'who holds the role');
