-- ACC-09 — a retired capability grants nothing, so it stops no role change (QA-56): partners.assign,
-- partners.identify and partners.merge gave way to each side's own (V98), and the old grants they left on the roles
-- give nothing, so an admin makes anyone a head or a manager (only admins change access — ACC-05). Made up.
-- Sabotage: supabase/tests/sabotage/a-retired-capability-blocks-a-role.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select test.as_owner();
select test.ok(exists (select 1 from core.role_capability c
                       join core.capability k on k.key = c.capability_key and not k.active
                       join core.role r on r.id = c.role_id and r.key in ('head', 'manager')
                       where c.granted and c.deleted_at is null),
  'the head and manager roles still carry grants of a retired capability');

select set_config('t.r_head', (select id::text from core.role where key = 'head'), true);
select set_config('t.r_manager', (select id::text from core.role where key = 'manager'), true);

select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am1'),
  current_setting('t.r_head'), 'made up: promoted'), 'an admin makes a team member a head');
select test.runs(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am2'),
  current_setting('t.r_manager'), 'made up: promoted'), 'and another a manager');
select test.as_owner();
select test.eq((select string_agg(r.key, ', ' order by r.key) from core.person p join core.role r on r.id = p.role_id
                where p.id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid)), 'head, manager',
  'both hold their new role');

