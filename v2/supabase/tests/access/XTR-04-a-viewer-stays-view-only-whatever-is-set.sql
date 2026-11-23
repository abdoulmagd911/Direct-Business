-- XTR-04 — per-member settings (Landing 40): a Viewer stays view-only. "Allowed" is refused on a Viewer for each of
-- the three extras, in words; a grant that reached a Viewer some other way (a stray row, or a role changed to Viewer
-- afterwards) gives nothing — no import, no credit limit, no edit. "View only" on a Viewer is accepted: it changes
-- nothing. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-viewer-keeps-a-stray-extra.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.v', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.m', test.person('Test Member M', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.v')::uuid, current_setting('t.a')::uuid, current_setting('t.m')::uuid);

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.access_set_person_capability(%L, %L, true, %L)', current_setting('t.v'), 'finance.import', 'made up'),
  '42501', 'Allowed on Import is refused on a Viewer', 'access.viewer_stays_view_only');
select test.raises(format('select api.access_set_person_capability(%L, %L, true, %L)', current_setting('t.v'), 'records.edit_others', 'made up'),
  '42501', 'Allowed on Edit someone else''s work is refused on a Viewer', 'access.viewer_stays_view_only');
select test.raises(format('select api.access_set_person_capability(%L, %L, true, %L)', current_setting('t.v'), 'finance.credit_control', 'made up'),
  '42501', 'Allowed on Change credit limits is refused on a Viewer', 'access.viewer_stays_view_only');
select test.runs(format('select api.access_set_person_capability(%L, %L, false, %L)', current_setting('t.v'), 'finance.import', 'made up: view only'),
  'View only on a Viewer is accepted');

-- a task of a member, for the edit check
select test.as_person(current_setting('t.a')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up checklist of A')) ->> 'id', true);

-- a stray grant on the Viewer, and a member with all three extras whose role then becomes Viewer
select test.as_owner();
update core.person_capability set granted = true where person_id = current_setting('t.v')::uuid and capability_key = 'finance.import';
insert into core.person_capability (person_id, capability_key, granted, reason) values
  (current_setting('t.v')::uuid, 'records.edit_others', true, 'made up: a stray row'),
  (current_setting('t.v')::uuid, 'finance.credit_control', true, 'made up: a stray row'),
  (current_setting('t.m')::uuid, 'finance.import', true, 'made up: set while a member'),
  (current_setting('t.m')::uuid, 'records.edit_others', true, 'made up: set while a member'),
  (current_setting('t.m')::uuid, 'finance.credit_control', true, 'made up: set while a member');
select test.ok(core.extra_access(current_setting('t.m')::uuid, 'finance.import'), 'a member with the extra holds it');
update core.person set role_id = (select id from core.role where key = 'viewer') where id = current_setting('t.m')::uuid;

select test.ok(not core.extra_access(current_setting('t.v')::uuid, 'finance.import'), 'a Viewer with a stray grant still holds no extra');
select test.ok(not core.extra_access(current_setting('t.m')::uuid, 'records.edit_others'), 'nor does a person whose role became Viewer');
select test.as_person(current_setting('t.v')::uuid);
select test.raises($$select work.import_require()$$, '42501', 'the Viewer does not import', 'access.needs_capability');
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, false, 'does not change the credit limit');
select test.raises($$select api.finance_credit_limit_set(1, 'made up: a viewer tries')$$, '42501', 'and is refused when they try', 'access.needs_capability');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'and edits nobody''s task');
select test.as_person(current_setting('t.m')::uuid);
select test.raises($$select work.import_require()$$, '42501', 'the person whose role became Viewer does not import', 'access.needs_capability');
select test.eq((api.finance_credit_limit() ->> 'can_edit')::boolean, false, 'nor change the credit limit');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'nor edit a teammate''s task');
