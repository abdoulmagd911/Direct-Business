-- TPL-04 — Settings › Work › Templates (TECH-SPEC §3.7, V97, V479): admins only; the eight seeds start switched off
-- (each needs an owner first); a template is generated or offered, never both; a schedule and a checklist hold a known
-- shape; a running template needs whom it runs for; its owner may work; one removed is gone from the list, and Undo
-- brings it back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-template-runs-for-nobody.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member')::text, true);
update core.person set active = false where id = current_setting('t.off')::uuid;

select test.as_person(current_setting('t.am1')::uuid);
select test.raises('select api.task_templates()', '42501', 'a member does not read the templates', 'access.needs_level');
select test.raises(format('select api.task_template_save(null, %L::jsonb)', '{"title": "Made up"}'), '42501',
  'nor adds one', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select array_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(api.task_templates()) x),
  array['Accreditation yearly review', 'Client feedback', 'Corporate onboarding', 'Legal review', 'New lead tickets',
        'Quarterly business review', 'Stats readings', 'Supplier onboarding'], 'the eight seeds');
select test.eq((select count(*)::int from jsonb_array_elements(api.task_templates()) x where (x ->> 'active')::boolean), 0,
  'all switched off until their owners are named');
select set_config('t.nl', (select x ->> 'id' from jsonb_array_elements(api.task_templates()) x
                           where x ->> 'title' = 'New lead tickets'), true);
select test.raises(format('select api.task_template_save(%L, %L::jsonb, 1)', current_setting('t.nl'), '{"active": true}'),
  'P0001', 'a daily template runs for someone', 'template.owner_required');
select test.raises(format('select api.task_template_save(%L, %L::jsonb, 1)', current_setting('t.nl'),
  jsonb_build_object('owner_id', current_setting('t.off'))), 'P0001', 'its owner may work', 'person.unavailable');
select test.eq((api.task_template_save(current_setting('t.nl')::uuid, jsonb_build_object('owner_id',
  current_setting('t.am1'), 'active', true), 1) ->> 'active')::boolean, true, 'with its owner named, it runs');

select test.raises(format('select api.task_template_save(null, %L::jsonb)', jsonb_build_object('title', 'Made up both',
  'work_type', 'internal', 'owner_id', current_setting('t.am1'), 'starts_on', '2026-10-01',
  'rule', jsonb_build_object('freq', 'daily'), 'offered_on', 'contract_added')), 'P0001', 'generated or offered, not both',
  'template.rule_or_offer');
select test.raises(format('select api.task_template_save(null, %L::jsonb)', jsonb_build_object('title', 'Made up hourly',
  'work_type', 'internal', 'owner_id', current_setting('t.am1'), 'starts_on', '2026-10-01',
  'rule', jsonb_build_object('freq', 'hourly'))), 'P0001', 'a known schedule', 'template.rule_invalid');
select test.raises(format('select api.task_template_save(null, %L::jsonb)', jsonb_build_object('title', 'Made up start',
  'work_type', 'internal', 'owner_id', current_setting('t.am1'), 'rule', jsonb_build_object('freq', 'daily'))), 'P0001',
  'a schedule starts somewhere', 'template.starts_required');
select test.raises(format('select api.task_template_save(null, %L::jsonb)', jsonb_build_object('title', 'Made up rows',
  'offered_on', 'contract_added', 'checklist', jsonb_build_array(jsonb_build_object('words', 'x')))), 'P0001',
  'a checklist row has its text', 'template.checklist_invalid');
select test.raises(format('select api.task_template_save(null, %L::jsonb)', jsonb_build_object('title', 'Made up type',
  'for_each', 'side_type', 'starts_on', '2026-10-01', 'rule', jsonb_build_object('freq', 'yearly'))), 'P0001',
  'a template over a side type names it', 'template.side_type_required');

select set_config('t.lr', (select x ->> 'id' from jsonb_array_elements(api.task_templates()) x
                           where x ->> 'title' = 'Legal review'), true);
select set_config('t.rm', api.task_templates_remove(array[current_setting('t.lr')::uuid], 'Made-up: not used') ->> 'request_id',
  true);
select test.eq(jsonb_array_length(api.task_templates()), 7, 'a removed template leaves the list');
select test.runs(format('select api.undo(%L)', current_setting('t.rm')), 'Undo');
select test.eq(jsonb_array_length(api.task_templates()), 8, 'brings it back');
