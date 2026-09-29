-- ACC-04 — nobody changes their own access (plan P3-4): an admin — the only one who changes access (V97) — changes
-- neither their own level or capability overrides, nor their own role, nor the starting levels of the role they hold;
-- another role's starting levels, yes.
-- Sabotage: supabase/tests/sabotage/people-change-their-own-access.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);

select set_config('t.role_member', (select id from core.role where key = 'member')::text, true);
select set_config('t.role_admin', (select id from core.role where key = 'admin')::text, true);
select set_config('t.role_head', (select id from core.role where key = 'head')::text, true);
select set_config('t.role_viewer', (select id from core.role where key = 'viewer')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.admin'), 'tasks',
  'view', 'made up'), '42501', 'an admin cannot change their own level', 'access.not_your_own');
select test.raises(format('select api.access_set_person_capability(%L, %L, %L, %L)', current_setting('t.admin'),
  'tasks.assign', false, 'made up'), '42501', 'nor their own capability', 'access.not_your_own');
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.admin'),
  current_setting('t.role_member')::uuid, 'made up'), '42501', 'nor their own role', 'access.not_your_own');

select test.raises(format('select api.access_set_role_level(%L, %L, %L, %L)', current_setting('t.role_admin'),
  'kpis', 'view', 'made up'), 'P0001', 'nor the starting levels of the role they hold', 'access.admin_role_has_everything');
select (api.access_set_role_level(current_setting('t.role_member')::uuid, 'kpis', 'view',
  'made up: another role') ->> 'id') is not null as ok_other_role;
select test.as_owner();
select test.eq((select l.level from core.role_page_level l join core.role r on r.id = l.role_id
                where r.key = 'member' and l.page_key = 'kpis' and l.deleted_at is null), 'view'::core.level,
  'another role''s starting level is theirs to change');
