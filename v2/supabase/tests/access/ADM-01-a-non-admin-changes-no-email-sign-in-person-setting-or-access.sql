-- ADM-01 — Settings, access, people and e-mails are admins' (V97; the owner's urgent fix of 29 Sep): a head — even
-- one given Full on Organization & access, as the old model allowed — can neither put a mailbox on an admin's person,
-- nor link a sign-in to an admin's e-mail, nor add a person, change a setting, a role, a list, anyone's access or the
-- block list; an admin can.
-- Sabotage: supabase/tests/sabotage/a-non-admin-adds-an-email-to-an-admin.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.role_member', (select id from core.role where key = 'member')::text, true);
select set_config('t.dep', (select id from core.department where code = 'commercial')::text, true);
-- the old model's grant; refused now (ACC-01 asserts it) — a world without the rule lets it in
do $$
begin
  insert into core.person_page_level (person_id, page_key, level, reason)
  values (current_setting('t.head')::uuid, 'settings.org', 'full', 'made up: the old grant');
exception when others then
  null;
end $$;

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.person_email_add(%L, %L)', current_setting('t.admin'), 'made.up.head@example.test'),
  '42501', 'a non-admin puts no e-mail on an admin''s person', 'access.needs_admin');
select test.raises(format('select api.person_auth_link(%L, %L)', 'made.up.admin@example.test', gen_random_uuid()), '42501',
  'nor links a sign-in to an admin''s e-mail', 'access.needs_admin');
select test.raises(format('select api.person_create(%L)', jsonb_build_object('full_name_en', 'Test Made Up',
  'department_id', current_setting('t.dep'), 'role_id', current_setting('t.role_member'))),
  '42501', 'nor adds a person', 'access.needs_level');
select test.raises($$select api.setting_set('audit.undo_window_hours', null, '48', null, 'made up')$$, '42501',
  'nor changes a setting', 'access.needs_level');
select test.raises($$select api.role_save(null, 'made_up_role', 'Made up')$$, '42501', 'nor saves a role',
  'access.needs_level');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.am1'), 'kpis', 'full',
  'made up'), '42501', 'nor changes anyone''s access', 'access.needs_level');
select test.raises($$select api.list_save('side_type', null, '{"side": "client", "key": "made_up", "name_en": "Made up", "name_ar": "متخيل"}')$$,
  '42501', 'nor a list', 'access.needs_level');
select test.raises($$select api.identifier_block_add('email', 'domain', 'made.up', 'made up')$$, '42501',
  'nor the block list', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.ok((api.person_email_add(current_setting('t.am1')::uuid, 'made.up.second@example.test') ->> 'id') is not null,
  'an admin adds an e-mail');
