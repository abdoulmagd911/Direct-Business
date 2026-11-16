-- CCL-01 — the credit limit of Settings → Finance (Landing 31, the owner's decision of 16 Nov 2026). It starts at the
-- registry's default; every signed-in person reads it; a manager, a head of department and an admin change it, each
-- change with its reason, logged as a setting change; a team member and a viewer are refused and still read it; the
-- amount is a whole positive number of riyals; the Settings page itself stays an admin's (V97). Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-member-changes-the-credit-limit.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am', test.person('Test Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);

-- everyone reads it, and it starts at the default
select test.as_person(current_setting('t.am')::uuid);
select test.eq(api.finance_credit_limit() - 'set_at',
  '{"amount": 1250000, "can_edit": false, "is_default": true}'::jsonb,
  'a team member reads the credit limit — the default — and is told they cannot change it');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, false, 'a viewer reads it too, and cannot change it');

-- a manager changes it: logged, with the reason
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, true, 'a manager is told they can change it');
select set_config('t.r', api.finance_credit_limit_set(900000, 'made up: a tighter quarter')::text, true);
select test.eq((api.finance_credit_limit() ->> 'amount')::bigint, 900000::bigint, 'a manager changes the credit limit');
select test.eq((api.finance_credit_limit() ->> 'is_default')::boolean, false, 'and it is no longer the default');
select test.as_owner();
select test.eq(core.setting_at('finance.credit_limit', null, core.riyadh_today()), '900000'::jsonb,
  'the change is the setting in force today');
select test.ok(exists (select 1 from audit.change c
                       where c.request_id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid
                         and c.table_name = 'core.setting'),
  'the change is logged');
select test.eq((select s.reason from core.setting s where s.id = (current_setting('t.r')::jsonb ->> 'id')::uuid),
  'made up: a tighter quarter', 'with its reason');

-- a head of department and an admin change it too; the same day's earlier change is replaced, never edited in place
select test.as_person(current_setting('t.head')::uuid);
select api.finance_credit_limit_set(1100000, 'made up: the head raises it');
select test.eq((api.finance_credit_limit() ->> 'amount')::bigint, 1100000::bigint, 'a head of department changes it');
select test.as_person(current_setting('t.admin')::uuid);
select api.finance_credit_limit_set(1500000, 'made up: the admin raises it');
select test.eq((api.finance_credit_limit() ->> 'amount')::bigint, 1500000::bigint, 'an admin changes it');
select test.as_owner();
select test.eq((select count(*)::int from core.setting where key = 'finance.credit_limit' and department_id is null
                and valid_from = core.riyadh_today() and deleted_at is null), 1,
  'one row in force for the day: an earlier change of the same day is replaced');
select test.eq((select count(*)::int from core.setting where key = 'finance.credit_limit' and department_id is null
                and reason = 'default' and valid_from = date '2000-01-01' and deleted_at is null), 1,
  'and the default row at the floor date stays');

-- a team member and a viewer are refused, and still read it
select test.as_person(current_setting('t.am')::uuid);
select test.raises($$select api.finance_credit_limit_set(1, 'made up: a member tries')$$,
  '42501', 'a team member cannot change the credit limit', 'access.needs_capability');
select test.eq((api.finance_credit_limit() ->> 'amount')::bigint, 1500000::bigint, 'and still reads it');
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises($$select api.finance_credit_limit_set(1, 'made up: a viewer tries')$$,
  '42501', 'a viewer cannot change the credit limit', 'access.needs_capability');

-- a whole positive amount, with a reason
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises($$select api.finance_credit_limit_set(1000.5, 'made up: halalas')$$,
  'P0001', 'an amount with a fraction is refused', 'setting.invalid_value');
select test.raises($$select api.finance_credit_limit_set(0, 'made up: nothing')$$,
  'P0001', 'zero is refused', 'setting.invalid_value');
select test.raises($$select api.finance_credit_limit_set(-5, 'made up: below zero')$$,
  'P0001', 'a negative amount is refused', 'setting.invalid_value');
select test.raises($$select api.finance_credit_limit_set(null, 'made up: no amount')$$,
  'P0001', 'no amount is refused', 'setting.invalid_value');
select test.raises($$select api.finance_credit_limit_set(800000, '  ')$$,
  'P0001', 'a change without a reason is refused', 'common.reason_required');
select test.eq((api.finance_credit_limit() ->> 'amount')::bigint, 1500000::bigint, 'and a refused change changes nothing');

-- the Settings page itself stays an admin's (V97): the door is for the one figure
select test.raises($$select api.settings('settings.finance')$$,
  '42501', 'a manager still cannot open Settings → Finance''s settings', 'access.needs_level');
select test.raises($$select api.setting_set('finance.credit_limit', null, '5', null, 'made up: by the settings door')$$,
  '42501', 'nor change the figure through the settings door', 'access.needs_level');
