-- FIX03-02 — Finance follows the access each person has, and a Team member starts with none.
-- History: Landing 7 (owner decision 10 Nov 2026: "everyone can see what they have access to, and it can be edited in
-- the Settings of the Commercial Workspace") made the level a setting and started Members and Viewers at View.
-- Landing 34 (the owner's test round of 19 Nov, item 5: "Members must NOT see Finance") moves the Team member role to
-- NONE on Finance and on a partner's Finance tab (registry sync 20261120105626 + the level migration 20261120110000).
-- It is still a setting: an admin may raise a role or one person in Settings › People & access › Access, and the page,
-- the menu and the figures follow. A Viewer keeps View; a manager still reads it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-member-starts-with-view-on-finance.sql.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.eq(authz.level_of(current_setting('t.mem')::uuid, 'finance'), 'none', 'a member starts with no access to Finance');
select test.eq(authz.level_of(current_setting('t.mem')::uuid, 'partner_finance'), 'none', 'nor to a partner''s Finance tab');
select test.eq(authz.level_of(current_setting('t.viewer')::uuid, 'finance'), 'view', 'a viewer starts at View');
select test.eq(authz.level_of(current_setting('t.mgr')::uuid, 'finance'), 'full', 'a manager at Full');

select test.as_person(current_setting('t.mem')::uuid);
select test.raises('select api.finance_period(current_date - 30, current_date)', '42501',
  'a member is refused the finance figures', 'access.needs_level');
select test.raises($$select api.finance_unified_ledger(current_date - 30, current_date)$$, '42501',
  'and the ledger', 'access.needs_level');
select test.eq((api.me() -> 'levels' ->> 'finance'), 'none', 'the member''s own levels say none, so the menu hides Finance');
select test.as_person(current_setting('t.viewer')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a viewer reads the finance figures');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a manager still reads the finance figures');

-- the setting controls it: a member given View — the per-person override, the same control the access matrix in
-- Settings writes — reads the figures; one left alone stays refused
select set_config('t.allowed', test.person('Test Allowed Member', 'member')::text, true);
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.allowed')::uuid, 'finance', 'view', 'made up: View on Finance');
select test.as_person(current_setting('t.allowed')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)',
  'a member given View in Settings reads the finance figures');
