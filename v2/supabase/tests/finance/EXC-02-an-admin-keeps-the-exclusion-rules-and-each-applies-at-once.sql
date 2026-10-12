-- EXC-02 — the exclusion rules are kept by an admin and apply at once (D16, V458). An admin adds a rule and the row it
-- catches leaves the figures at once, the list showing the rule with its row and riyals; switching it to hide takes the
-- row out of sight; the same rule twice is refused; removing it counts the row again, and one Undo brings the rule
-- back. A head of department — Full on Finance, not an admin — can neither read, add nor remove a rule. Every value
-- is made up.
-- Sabotage: supabase/tests/sabotage/a-head-keeps-the-exclusion-rules.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin', 'commercial')::text, true);
select set_config('t.d', (core.riyadh_today() - 6)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-X1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 250,
                     'client_id', '85501'),
  jsonb_build_object('ref', 'TX-X2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 40,
                     'client_id', '85502')),
  now() - interval '1 day');
select test.raises($$select api.finance_exclusion_rule_save(null, '{"kind": "client_id", "value": "85501", "reason": "made up"}')$$,
  '42501', 'a head cannot add a rule');
select test.raises($$select api.finance_exclusion_rules()$$, '42501', 'nor read the rules');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r', api.finance_exclusion_rule_save(null,
  '{"kind": "client_id", "value": "85501", "reason": "made up: a test client"}', null, 'made up: found in the review') ->> 'id', true);
select test.eq((api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  40::numeric, 'the row the rule catches leaves the figures at once');
select test.eq((select jsonb_build_object('mode', e -> 'mode', 'rows', e -> 'rows', 'amount', e -> 'amount_sar')
                from jsonb_array_elements(api.finance_exclusion_rules()) e),
  '{"mode": "exclude", "rows": 1, "amount": 250}'::jsonb, 'the list shows the rule with what it catches');
select test.raises($$select api.finance_exclusion_rule_save(null, '{"kind": "client_id", "value": " 85501 ", "reason": "again"}')$$,
  '23505', 'the same rule twice is refused', 'finance.exclusion_rule_exists');
select api.finance_exclusion_rule_save(current_setting('t.r')::uuid, '{"mode": "hide"}', 1, 'made up: never show it');
select test.as_owner();
select test.eq((select count(*)::int from finance.money_row where ref = 'TX-X1'), 0, 'switched to hide, the row is out of sight');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.finance_exclusion_rule_remove(%L, %L)', current_setting('t.r'), 'made up'),
  '42501', 'a head cannot remove a rule');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.req', api.finance_exclusion_rule_remove(current_setting('t.r')::uuid, 'made up: a real client after all')
                           ->> 'request_id', true);
select test.eq((api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  290::numeric, 'removed, the row counts again');
select api.undo(current_setting('t.req')::uuid);
select test.eq((api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  40::numeric, 'one Undo brings the rule back');
