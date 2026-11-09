-- FIX03-02 — Finance is refused to Members and Viewers (FIX-03 F179, P2). The role starting levels for the finance
-- page are 'none' for both roles (registry sync 20261109000034 + the level migration 20261109000035): the whole
-- Finance page, figures included, is refused — the overview's period read asks for 'view' on Finance. A manager
-- still reads it. Every value is made up.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.eq(authz.level_of(current_setting('t.mem')::uuid, 'finance'), 'none', 'a member holds no finance level');
select test.eq(authz.level_of(current_setting('t.viewer')::uuid, 'finance'), 'none', 'nor does a viewer');

select test.as_person(current_setting('t.mem')::uuid);
select test.raises('select api.finance_period(current_date - 30, current_date)', '42501',
  'a member is refused the finance figures', 'access.needs_level');
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises('select api.finance_period(current_date - 30, current_date)', '42501',
  'a viewer is refused the finance figures', 'access.needs_level');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a manager still reads the finance figures');
