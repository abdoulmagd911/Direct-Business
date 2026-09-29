-- ACC-05 — a manager grants at most their own level (plan P3-4): no level above their own on that page, no
-- capability they lack, no role that starts above them, and no clearing an override when what remains would exceed
-- their own. A reason is required, the level must be one the page offers, and each change is one logged request.
-- Sabotage: supabase/tests/sabotage/grants-above-your-level.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);

select set_config('t.role_member', (select id from core.role where key = 'member')::text, true);
select set_config('t.role_head', (select id from core.role where key = 'head')::text, true);
select set_config('t.role_viewer', (select id from core.role where key = 'viewer')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.head')::uuid, 'settings.org', 'full', 'made up: runs access');
select api.access_set_person_level(current_setting('t.head')::uuid, 'finance', 'view', 'made up: views finance only');
select api.access_set_person_level(current_setting('t.am1')::uuid, 'finance', 'view', 'made up: starts at view');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'), 'finance',
  'full', 'made up'), '42501', 'a head at View on Finance cannot give Full', 'access.above_your_level');
select test.raises(format('select api.access_set_person_capability(%L, %L, %L, %L)', current_setting('t.am1'),
  'org.sign_out', true, 'made up'), '42501', 'nor a capability they lack', 'access.above_your_level');
select test.raises(format('select api.access_clear_person_level(%L, %L, %L)', current_setting('t.am1'), 'finance',
  'made up'), '42501', 'nor clear an override when the role''s Own would exceed their View', 'access.above_your_level');
select test.raises(format('select api.access_set_person_role(%L, %L, %L)', current_setting('t.am1'),
  current_setting('t.role_head')::uuid, 'made up'), '42501', 'nor give a role that starts above them',
  'access.above_your_level');
select test.raises(format('select api.access_set_role_level(%L, %L, %L, %L)', current_setting('t.role_member')::uuid,
  'finance', 'full', 'made up'), '42501', 'nor raise a role above their own level', 'access.above_your_level');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'), 'kpis',
  'view', '  '), 'P0001', 'a reason is required', 'common.reason_required');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'),
  'settings.profile', 'view', 'made up'), 'P0001', 'only a level the page offers', 'access.level_not_offered');

select api.access_set_person_level(current_setting('t.am1')::uuid, 'kpis', 'view', 'made up: at their level');
select api.access_set_person_capability(current_setting('t.am1')::uuid, 'partners.merge', true, 'made up: they hold it');
select api.access_set_person_role(current_setting('t.am1')::uuid, current_setting('t.role_viewer')::uuid,
  'made up: a role within theirs');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.am1')::uuid, 'kpis'), 'view'::core.level, 'within their level: done');
select test.ok(authz.can_of(current_setting('t.am1')::uuid, 'partners.merge'), 'a capability they hold: given');
select test.eq((select r.key from core.person p join core.role r on r.id = p.role_id
                where p.id = current_setting('t.am1')::uuid), 'viewer', 'a role within theirs: given');
select test.eq((select q.actor_id from audit.request q where q.label_key = 'access.person_level_set'
                  and q.label_args ->> 'page' = 'kpis'), current_setting('t.head')::uuid,
  'each change is a request logged under the person who made it');
