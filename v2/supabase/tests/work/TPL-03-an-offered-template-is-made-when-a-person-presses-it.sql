-- TPL-03 — an offered template (TECH-SPEC §3.7; V89, V479): an event offers its templates (Corporate onboarding when a
-- Client side is on), each with the task it last made for that organisation; pressing one makes the task through the
-- task's own door — its rules hold — with its checklist as action items, in one request, once a day per organisation.
-- The job never makes an offered template. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-offered-template-loses-its-checklist.sql,
-- an-offered-template-is-made-twice-a-day.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up New Client Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

-- the seeded Corporate onboarding, switched on by an admin
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.co', (select x ->> 'id' from jsonb_array_elements(api.task_templates()) x
                           where x ->> 'title' = 'Corporate onboarding'), true);
select api.task_template_save(current_setting('t.co')::uuid, '{"active": true}'::jsonb, 1);

select test.as_person(current_setting('t.am1')::uuid);
select test.eq((select array_agg(x ->> 'title') from jsonb_array_elements(api.templates_offered('client_on',
                  current_setting('t.p')::uuid)) x), array['Corporate onboarding'],
  'a Client side switched on offers Corporate onboarding');
select test.eq(api.templates_offered('contract_added', current_setting('t.p')::uuid), '[]'::jsonb,
  'a template switched off is not offered');
select set_config('t.made', api.task_from_template(current_setting('t.co')::uuid,
  jsonb_build_object('partner_id', current_setting('t.p'), 'due_on', core.riyadh_today() + 14))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'title', 'Corporate onboarding', 'pressing it makes the task');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'owner_id', current_setting('t.am1'), 'its presser''s');
select test.eq((select jsonb_agg(x ->> 'text' order by o) from jsonb_array_elements(api.task(current_setting('t.t')::uuid)
                  -> 'action_items') with ordinality e(x, o)),
  '["Agreement signed and stamped", "Account set up", "Travel policy received", "Operations briefed", "First request"]'::jsonb,
  'with its checklist, in order');
select test.eq(api.templates_offered('client_on', current_setting('t.p')::uuid) -> 0 ->> 'last_task_id',
  current_setting('t.t'), 'the offer names the task it made');
select test.raises(format('select api.task_from_template(%L, %L::jsonb)', current_setting('t.co'),
  jsonb_build_object('partner_id', current_setting('t.p'))), 'P0001', 'once a day for an organisation',
  'template.applied_today');
select test.raises(format('select api.task_from_template(%L, %L::jsonb)', current_setting('t.co'),
  jsonb_build_object('partner_id', current_setting('t.p'), 'owner_id', current_setting('t.am2'), 'happened_on',
                     core.riyadh_today() - 1)), '42501', 'the task door''s rules hold', 'access.needs_capability');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select id from work.action_item where task_id = current_setting('t.t')::uuid)
                   or c.row_id = current_setting('t.t')::uuid), 1, 'the task and its checklist are one request');
select test.eq((select origin from work.task where id = current_setting('t.t')::uuid), 'template', 'from a template');

-- the job never makes an offered template
select work.generate_recurring();
select test.eq((select count(*)::int from work.task_occurrence where template_id = current_setting('t.co')::uuid), 1,
  'the job leaves an offered template alone');
