-- FIX03-02 — Finance follows the access each person has: a Team member starts at OWN, a Viewer at View.
-- Landing 56 (the owner, 26 Nov 2026: "Own clients only" on Finance): the Team member role starts at Own on Finance
-- and on a partner's Finance tab — it reads every figure and the ledger, and changes entries of its own clients
-- (OWN-02); a change that asks for Full on Finance is a manager's. The history below is how it came to Full first.
-- History: Landing 7 (owner decision 10 Nov 2026: "everyone can see what they have access to, and it can be edited in
-- the Settings of the Commercial Workspace") made the level a setting and started Members and Viewers at View.
-- Landing 34 (the test round of 19 Nov, item 5) moved the Team member role to None. Landing 34b (the owner, 21 Nov
-- 2026: "everyone sees Finance and everyone adds and edits it — members, managers, admins; only the view-only roles
-- see it but cannot edit") overrules that: the Team member role starts at Full on Finance and on a partner's Finance
-- tab (registry sync 20261121090100 + the level migration 20261121090200) — it reads the figures and the ledger and
-- makes a Full-gated change; a Viewer starts at View — reads, and is refused the same change. It is still a setting:
-- an admin may lower a role or one person in Settings › People & access › Access, and a member held at None is
-- refused the page's reads. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-member-starts-with-none-on-finance.sql,
-- a-member-starts-with-none-on-a-partners-finance-tab.sql, a-viewer-starts-at-full-on-finance.sql.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.p', (select id from finance.product where word = 'Direct Visas')::text, true);
select set_config('t.pv', (select version from finance.product where id = current_setting('t.p')::uuid)::text, true);

-- a member: Own on both pages (Landing 56), and reads; a change that asks for Full on Finance is a manager's
select test.eq(authz.level_of(current_setting('t.mem')::uuid, 'finance'), 'own', 'a member starts at Own on Finance');
select test.eq(authz.level_of(current_setting('t.mem')::uuid, 'partner_finance'), 'own', 'and on a partner''s Finance tab');
select test.eq(authz.level_of(current_setting('t.mgr')::uuid, 'finance'), 'full', 'a manager at Full');
select test.as_person(current_setting('t.mem')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)', 'a member reads the finance figures');
select test.runs($$select api.finance_unified_ledger(current_date - 30, current_date)$$, 'and the ledger');
select test.eq((api.me() -> 'levels' ->> 'finance'), 'own', 'the member''s own levels say own, so the menu shows Finance');
select test.eq((api.me() -> 'levels' ->> 'partner_finance'), 'own', 'and own on a partner''s Finance tab');

-- a viewer: reads, and is refused a change — the no-supplier-cost flag asks for Full on Finance (FNS-01)
select test.as_person(current_setting('t.viewer')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)', 'a viewer reads the finance figures');
select test.runs($$select api.finance_unified_ledger(current_date - 30, current_date)$$, 'a viewer reads the ledger');
select test.raises(format('select api.finance_no_supplier_cost_set(%L, true, %s, %L)', current_setting('t.p'),
                          current_setting('t.pv'), 'made up: a viewer tries'),
  '42501', 'a viewer is refused a change on Finance', 'access.needs_level');
select test.eq((api.me() -> 'levels' ->> 'finance'), 'view', 'the viewer''s own levels say view');
select test.as_owner();
select test.eq(authz.level_of(current_setting('t.viewer')::uuid, 'finance'), 'view', 'a viewer starts at View on Finance');
select test.eq(authz.level_of(current_setting('t.viewer')::uuid, 'partner_finance'), 'view', 'and on a partner''s Finance tab, View');
select test.eq((select no_supplier_cost from finance.product where id = current_setting('t.p')::uuid), false,
  'the refused change changed nothing');
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.finance_no_supplier_cost_set(%L, true, %s, %L)', current_setting('t.p'),
                          current_setting('t.pv'), 'made up: a member tries'),
  '42501', 'a member at Own is refused a change that asks for Full', 'access.needs_level');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.finance_no_supplier_cost_set(%L, true, %s, %L)', current_setting('t.p'),
                        current_setting('t.pv'), 'made up: visas carry no supplier cost'),
  'a manager makes the change a viewer is refused');
select test.as_owner();
select test.eq((select no_supplier_cost from finance.product where id = current_setting('t.p')::uuid), true,
  'and the manager''s change is saved');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs('select api.finance_period(current_date - 30, current_date)', 'a manager still reads the finance figures');

-- the level is still a setting: a member held at None — the per-person override, the same control the access matrix
-- in Settings writes — is refused the figures and the ledger, and their own levels say none; one left alone is not
select set_config('t.held', test.person('Test Held Member', 'member')::text, true);
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.held')::uuid, 'finance', 'none', 'made up: no Finance for this member');
select test.eq(authz.level_of(current_setting('t.held')::uuid, 'finance'), 'none', 'a member held at None in Settings has none');
select test.as_person(current_setting('t.held')::uuid);
select test.raises('select api.finance_period(current_date - 30, current_date)', '42501',
  'a member held at None is refused the finance figures', 'access.needs_level');
select test.raises($$select api.finance_unified_ledger(current_date - 30, current_date)$$, '42501',
  'and the ledger', 'access.needs_level');
select test.eq((api.me() -> 'levels' ->> 'finance'), 'none', 'the held member''s own levels say none, so the menu hides Finance');
