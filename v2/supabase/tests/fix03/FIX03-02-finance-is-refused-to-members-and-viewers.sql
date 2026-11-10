-- FIX03-02 — Finance follows the access each person has (Landing 7, F179 overturn, owner decision 10 Nov 2026:
-- "everyone can see what they have access to, and it can be edited in the Settings of the Commercial Workspace").
-- The role starting levels for the finance page are 'view' for Members and Viewers (registry sync 20261109000043 +
-- the level migration 20261109000044): they read the Finance page and its figures — the overview's period read asks
-- for 'view' on Finance. The level is a setting in Settings › People & access › Access, where the admin can change
-- any role's level; a level of none — set there, or by a person override — still refuses the page, figures included.
-- A manager still reads it. Every value is made up.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.eq(authz.level_of(current_setting('t.mem')::uuid, 'finance'), 'view', 'a member starts at View on Finance');
select test.eq(authz.level_of(current_setting('t.viewer')::uuid, 'finance'), 'view', 'and so does a viewer');

select test.as_person(current_setting('t.mem')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a member reads the finance figures');
select test.as_person(current_setting('t.viewer')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a viewer reads the finance figures');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a manager still reads the finance figures');

-- the setting controls it: a member whose level is set to none — the per-person override, the same control the
-- access matrix in Settings writes — is refused the figures again
select set_config('t.refused', test.person('Test Refused Member', 'member')::text, true);
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.refused')::uuid, 'finance', 'none', 'made up: no Finance access');
select test.as_person(current_setting('t.refused')::uuid);
select test.raises('select api.finance_period(current_date - 30, current_date)', '42501',
  'a member set to none in Settings is refused the finance figures', 'access.needs_level');
