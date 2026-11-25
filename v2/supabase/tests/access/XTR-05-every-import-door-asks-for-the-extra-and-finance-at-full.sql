-- XTR-05 — per-member settings (Landing 51): every import door asks the same thing. The older door
-- (api.finance_import) is held to the rule of the newer ones: a team member whose record says "Allowed" imports, a
-- team member without it does not, a Viewer never — not even a person whose role became Viewer while their record
-- still said "Allowed" — and a head set to "View only" does not. Importing writes Finance, so a person set to
-- "Allowed" whose Finance level was lowered below Full imports through no door. Every value is made up.
-- Sabotages: supabase/tests/sabotage/the-older-import-door-asks-for-the-capability-alone.sql,
--            supabase/tests/sabotage/importing-needs-no-level-on-finance.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);
select set_config('t.m', test.person('Test Member M', 'member')::text, true);
select set_config('t.low', test.person('Test Member Low', 'member')::text, true);
select set_config('t.v', test.person('Test Viewer', 'viewer')::text, true);
-- one call of the older door: a preview (a dry run) of an empty invoice file
select set_config('t.call', $$select api.finance_import('invoices', '[]'::jsonb, now(), 'made-up.csv', repeat('a', 64), true)$$, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Xtr05 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select test.runs(current_setting('t.call'), 'by role a head of department imports through the older door');

-- a team member with the extra can, a team member without it cannot
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.a')::uuid, 'finance.import', true, 'made up: she does the monthly review');
select api.access_set_person_capability(current_setting('t.m')::uuid, 'finance.import', true, 'made up: set while a member');
select api.access_set_person_capability(current_setting('t.low')::uuid, 'finance.import', true, 'made up: set before the level changed');
select test.as_person(current_setting('t.a')::uuid);
select test.runs(current_setting('t.call'), 'a team member set to Allowed imports through the older door');
select test.ok(api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv') ->> 'id' <> '',
  'and through the newer one');
select test.as_person(current_setting('t.b')::uuid);
select test.raises(current_setting('t.call'), '42501', 'a team member without the extra cannot import through the older door',
  'access.needs_capability');
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'nor through the newer one', 'access.needs_capability');

-- a Viewer never: by role, and with a setting left over from before the role changed
select test.as_person(current_setting('t.v')::uuid);
select test.raises(current_setting('t.call'), '42501', 'a Viewer cannot import through the older door', 'access.needs_capability');
select test.as_owner();
update core.person set role_id = (select id from core.role where key = 'viewer') where id = current_setting('t.m')::uuid;
select test.as_person(current_setting('t.m')::uuid);
select test.raises(current_setting('t.call'), '42501',
  'a person whose role became Viewer cannot import through the older door, whatever their record still says',
  'access.needs_capability');
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'nor through the newer one', 'access.needs_capability');

-- "View only" on a head
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.head')::uuid, 'finance.import', false, 'made up: on leave cover');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(current_setting('t.call'), '42501', 'a head set to View only cannot import through the older door',
  'access.needs_capability');

-- importing writes Finance: below Full on Finance, "Allowed" imports through no door
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.low')::uuid, 'finance', 'view', 'made up: reads Finance only');
select test.as_person(current_setting('t.low')::uuid);
select test.raises(current_setting('t.call'), '42501', 'Allowed with Finance at View cannot import through the older door',
  'access.needs_level');
select test.raises($$select work.import_require()$$, '42501', 'the one rule every import door asks says so', 'access.needs_level');
select test.raises(format('select api.import_expense_preview(%L, %L::jsonb)', current_setting('t.p'), '[]'),
  '42501', 'so the expense preview refuses too', 'access.needs_level');
