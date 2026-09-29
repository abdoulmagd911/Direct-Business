-- ACC-05 — only admins change access (V97; replaces P3-4's "at most your own level"): a head, a manager and a team
-- member are each refused every access write — levels, capabilities, roles — and the refusal names Organization &
-- access · Full; an admin's change still needs a reason and a level the page offers, and each is one request logged
-- under the admin.
-- Sabotage: supabase/tests/sabotage/access-open-to-heads.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.manager', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.role_viewer', (select id from core.role where key = 'viewer')::text, true);
-- the old model's grant; refused now — a world without the rule lets it in
do $$
begin
  insert into core.person_page_level (person_id, page_key, level, reason)
  values (current_setting('t.head')::uuid, 'settings.org', 'full', 'made up: the old grant');
exception when others then
  null;
end $$;

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'), 'kpis', 'view',
  'made up'), '42501', 'a head changes nobody''s level', 'access.needs_level');
select test.raises(format('select api.access_set_person_capability(%L, %L, %L, %L)', current_setting('t.am1'),
  'clients.merge', true, 'made up'), '42501', 'nor capability', 'access.needs_level');
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am1'),
  current_setting('t.role_viewer'), 'made up'), '42501', 'nor role', 'access.needs_level');
select test.raises(format('select api.access_set_role_level(%L, %L, %L, %L)', current_setting('t.role_viewer'), 'kpis',
  'none', 'made up'), '42501', 'nor a role''s starting level', 'access.needs_level');
select test.as_person(current_setting('t.manager')::uuid);
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'), 'kpis', 'view',
  'made up'), '42501', 'nor does a manager', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'), 'kpis',
  'view', '  '), 'P0001', 'an admin gives a reason', 'common.reason_required');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'),
  'settings.profile', 'view', 'made up'), 'P0001', 'and only a level the page offers', 'access.level_not_offered');
select api.access_set_person_level(current_setting('t.am1')::uuid, 'kpis', 'view', 'made up: views the KPIs');
select api.access_set_person_capability(current_setting('t.am1')::uuid, 'clients.merge', true, 'made up: merges');
select api.access_set_person_role(current_setting('t.am1')::uuid, current_setting('t.role_viewer')::uuid,
  'made up: a viewer now');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'kpis'), 'view'::core.level, 'an admin''s change is made');
select test.ok(authz.can_of(current_setting('t.am1')::uuid, 'clients.merge'), 'a capability given');
select test.eq((select r.key from core.person p join core.role r on r.id = p.role_id
                where p.id = current_setting('t.am1')::uuid), 'viewer', 'a role given');
select test.eq((select q.actor_id from audit.request q where q.label_key = 'access.person_level_set'
                  and q.label_args ->> 'page' = 'kpis'), current_setting('t.admin')::uuid,
  'each change is a request logged under the admin who made it');
