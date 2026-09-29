-- QA-06 — Every write door refuses whoever lacks its level (V125, V132, V134): the refusals the suite never asked for.
-- On v2/main at 72577fa, deleting the level check from any of these doors leaves all 79 tests green (the QA auditor's
-- mutation run, docs/v2/QA-LOG.md, 2026-09-29, QA-06): partner.writable, partner.manager_set, identifier_remove,
-- block_add, individual_add, campaign_code_add, code_terms_add, contacts_remove, partner_get, hover; core.person_create,
-- person_guard_write, department_save, team_save, team_retire, role_save, access_guard, access_role_guard,
-- person_devices, setting_clear. This file passes on v2/main and fails when any one of those checks goes.
-- Made-up people and values only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.other', test.person('Test Other Member', 'member')::text, true);
select set_config('t.view', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.dep', test.department('qa_six')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'qa_six_team', 'QA Six Team', 'فريق مختلق');
select set_config('t.team', (select id::text from core.team where code = 'qa_six_team'), true);
select set_config('t.role', (select id::text from core.role where key = 'viewer'), true);

select set_config('t.none', test.person('Test No Partners', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.none')::uuid, 'clients', 'none', 'made up: no partners');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA6', 'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate'))), 'made up')
  ->> 'id', true);
select set_config('t.alias', api.identifier_add(current_setting('t.p')::uuid, 'name', 'Made Up Alias QA6', 'made up',
  'alias') ->> 'id', true);
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'QASIXCODE', 'made up')
  ->> 'id', true);
select set_config('t.contact', api.contact_save(current_setting('t.p')::uuid, null, '{"name_en": "Test Contact"}')
  ->> 'id', true);

-- Partners · Full without the capability: a member changes no account manager, identifier, code or individual
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client', current_setting('t.other')),
  '42501', 'a member without partners.assign cannot change the account manager', 'access.needs_capability');
select test.raises(format('select api.identifier_remove(%L, %L)', current_setting('t.alias'), 'made up'), '42501',
  'nor remove an identifier without partners.identify', 'access.needs_capability');
select test.raises($$select api.individual_add('Test Individual QA6', 'made up')$$, '42501',
  'nor list an individual', 'access.needs_capability');
select test.raises($$select api.campaign_code_add('QASIXCAMP', 'Made up campaign', null, null, null, 'made up')$$,
  '42501', 'nor add a campaign code', 'access.needs_capability');
select test.raises(format('select api.code_terms_add(%L, null, 5, %L, %L, %L)', current_setting('t.code'),
  current_setting('t.admin'), core.riyadh_today(), core.riyadh_today()), '42501', 'nor add a code''s terms',
  'access.needs_capability');

-- Partners · none: someone with no access reads no partner
select test.as_person(current_setting('t.none')::uuid);
select test.raises(format('select api.partner(%L)', current_setting('t.p')), '42501',
  'someone with no access to Partners cannot open a partner', 'access.needs_level');
select test.raises(format('select api.hover_partner(%L)', current_setting('t.p')), '42501', 'nor its hover card',
  'access.needs_level');

-- Partners · View is not Full: a viewer changes nothing on a partner
select test.as_person(current_setting('t.view')::uuid);
select test.raises(format('select api.partner_update(%L, %L, 1, %L)', current_setting('t.p'), '{"notes": "made up"}',
  'made up'), '42501', 'a viewer cannot change a partner', 'access.needs_level');
select test.raises(format('select api.contact_save(%L, null, %L)', current_setting('t.p'),
  '{"name_en": "Test Contact"}'), '42501', 'nor add a contact', 'access.needs_level');
select test.raises(format('select api.partner_side_set(%L, %L, %L, %L)', current_setting('t.p'), 'client',
  '{"type": "corporate"}', 'made up'), '42501', 'nor change its side', 'access.needs_level');
select test.raises(format('select api.contacts_remove(array[%L]::uuid[], %L)', current_setting('t.contact'), 'made up'),
  '42501', 'nor remove a contact', 'access.needs_level');
select test.raises($$select api.identifier_block_add('email', 'domain', 'example.org', 'made up')$$, '42501',
  'nor change the block list', 'access.needs_level');

-- Organization & access · Full: a member (none there) changes no person, department, team, role or access
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.person_create(%L, %L)', jsonb_build_object('full_name_en', 'Test Made Person',
  'department_id', current_setting('t.dep')), 'made up'), '42501', 'a member cannot add a person', 'access.needs_level');
select test.raises(format('select api.person_update(%L, %L, 1, %L)', current_setting('t.other'),
  '{"job_title_en": "Made-up Title"}', 'made up'), '42501', 'nor change a colleague''s record', 'access.needs_level');
select test.raises($$select api.department_save(null, 'qa_six_new', 'Made up department', 'قسم مختلق')$$, '42501',
  'nor add a department', 'access.needs_level');
select test.raises(format('select api.team_save(null, %L, %L, %L, %L)', current_setting('t.dep'), 'qa_six_more',
  'Made up team', 'فريق مختلق'), '42501', 'nor add a team', 'access.needs_level');
select test.raises(format('select api.team_retire(%L, null, %L)', current_setting('t.team'), 'made up'), '42501',
  'nor retire one', 'access.needs_level');
select test.raises($$select api.role_save(null, 'qa_six_role', 'Made up role', 'دور مختلق')$$, '42501',
  'nor add a role', 'access.needs_level');
select test.raises(format('select api.access_set_person_level(%L, %L, %L, %L)', current_setting('t.other'), 'partners',
  'none', 'made up'), '42501', 'nor change a colleague''s level', 'access.needs_level');
select test.raises(format('select api.access_set_role_level(%L, %L, %L, %L)', current_setting('t.role'), 'partners',
  'none', 'made up'), '42501', 'nor a role''s starting level', 'access.needs_level');
select test.raises(format('select * from api.person_devices(%L)', current_setting('t.other')), '42501',
  'nor list a colleague''s signed-in devices', 'access.needs_level');

-- A setting's group · Full: a member (none on App) returns no department to the company value
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('files.max_mb', current_setting('t.dep')::uuid, '5', null, 'made up: this department');
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.setting_clear(%L, %L, %L)', 'files.max_mb', current_setting('t.dep'), 'made up'),
  '42501', 'a member cannot clear a department''s setting', 'access.needs_level');
