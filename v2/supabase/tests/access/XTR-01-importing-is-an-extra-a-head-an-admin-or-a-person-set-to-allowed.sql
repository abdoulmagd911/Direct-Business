-- XTR-01 — per-member settings (Landing 40, the owner's approved design of 22 Nov 2026): importing files on Finance
-- is a specific extra, not every member's. An admin and a head of department import by role; a manager and a team
-- member do not, though both hold Finance at Full; a person whose record says "Allowed" does; a head set to
-- "View only" does not; "As their role" takes the person's own setting away again. Every change is logged with its
-- reason. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-import-doors-ask-for-no-extra.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);

-- by role: a head imports
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Xtr01 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.batch', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv') ->> 'id', true);
select test.ok(current_setting('t.batch') <> '', 'a head of department starts an import');

-- by role: a team member and a manager do not, with Finance at Full
select test.as_person(current_setting('t.b')::uuid);
select test.eq(api.me() -> 'levels' ->> 'finance', 'own', 'a team member holds Finance at Own'); -- Landing 56
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'a team member without the extra cannot start an import', 'access.needs_capability');
select test.raises(format('select api.import_apply(%L, %L::jsonb)', current_setting('t.batch'), '[]'),
  '42501', 'nor confirm one', 'access.needs_capability');
select test.ok(not (api.me() -> 'capabilities' ? 'finance.import'), 'and the screen is told they do not import');
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'a manager without the extra cannot start an import', 'access.needs_capability');

-- "Allowed" on one person: that person imports, their colleague still does not
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r', api.access_set_person_capability(current_setting('t.a')::uuid, 'finance.import', true,
  'made up: she does the monthly review')::text, true);
select test.as_person(current_setting('t.a')::uuid);
select test.ok(api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up-2.csv') ->> 'id' <> '',
  'a team member set to Allowed starts an import');
select test.ok(api.me() -> 'capabilities' ? 'finance.import', 'and the screen is told they import');
select test.as_person(current_setting('t.b')::uuid);
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'the setting changed that one person only', 'access.needs_capability');

-- the change is logged with its reason, and the record says who set it
select test.as_owner();
select test.ok(exists (select 1 from audit.change c
                       where c.request_id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid),
  'the change is in the log');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.access_of_person(current_setting('t.a')::uuid) -> 'capability_overrides' -> 0) - 'set_at',
  jsonb_build_object('capability', 'finance.import', 'granted', true, 'reason', 'made up: she does the monthly review',
                     'set_by', current_setting('t.admin')),
  'the record says what was set, why and by whom');

-- "View only" on a head: no import, though the role gives it
select api.access_set_person_capability(current_setting('t.head')::uuid, 'finance.import', false, 'made up: on leave cover');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'a head set to View only cannot start an import', 'access.needs_capability');

-- "As their role": the person's own setting is gone
select test.as_person(current_setting('t.admin')::uuid);
select api.access_clear_person_capability(current_setting('t.a')::uuid, 'finance.import', 'made up: review handed back');
select api.access_clear_person_capability(current_setting('t.head')::uuid, 'finance.import', 'made up: back from leave');
select test.as_person(current_setting('t.a')::uuid);
select test.raises(format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv'),
  '42501', 'back to As their role, the team member no longer imports', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select test.ok(api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up-3.csv') ->> 'id' <> '',
  'and the head imports again');
