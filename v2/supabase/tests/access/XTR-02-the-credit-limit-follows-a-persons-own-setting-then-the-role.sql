-- XTR-02 — per-member settings (Landing 40): Change credit limits. The company-wide limit of Settings → Finance is
-- changed by a manager, a head and an admin by role (Landing 31, unchanged); a team member set to "Allowed" changes it
-- too; a manager set to "View only" does not; "As their role" puts the role's rule back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-credit-limit-ignores-a-persons-own-setting.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);

select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, false, 'by role a team member cannot change it');

select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.a')::uuid, 'finance.credit_control', true, 'made up: covers credit this month');
select api.access_set_person_capability(current_setting('t.mgr')::uuid, 'finance.credit_control', false, 'made up: not this quarter');

select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, true, 'a team member set to Allowed is told they can change it');
select api.finance_credit_limit_set(800000, 'made up: agreed with the head');
select test.eq((api.finance_credit_limit() ->> 'amount')::bigint, 800000::bigint, 'and changes it');
select test.as_person(current_setting('t.b')::uuid);
select test.raises($$select api.finance_credit_limit_set(1, 'made up: a colleague tries')$$,
  '42501', 'the setting changed that one person only', 'access.needs_capability');

select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, false, 'a manager set to View only is told they cannot change it');
select test.raises($$select api.finance_credit_limit_set(700000, 'made up: a manager tries')$$,
  '42501', 'and is refused', 'access.needs_capability');

select test.as_person(current_setting('t.admin')::uuid);
select api.access_clear_person_capability(current_setting('t.mgr')::uuid, 'finance.credit_control', 'made up: back to the role');
select api.access_clear_person_capability(current_setting('t.a')::uuid, 'finance.credit_control', 'made up: cover is over');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, true, 'As their role: a manager changes it again');
select test.as_person(current_setting('t.a')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, false, 'As their role: a team member does not');
