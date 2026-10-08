-- TPL-01 — the recurring-tasks job (TECH-SPEC §3.7; V72, V401, V479). A scheduled template makes one task per
-- occurrence and organisation it runs for — each key client, owned by its account manager — however often the job
-- runs; due on the occurrence's day (lead days earlier), made today, origin template, its checklist as action items, its
-- owner told once; each task is a job request attributed to the template's maker. A template switched off, past its
-- end, or with nobody to own it makes nothing. A yearly template over a side type links last year's files. Every value
-- is made up.
-- Sabotages: supabase/tests/sabotage/the-job-makes-an-occurrence-twice.sql, a-template-task-is-the-makers.sql,
-- the-job-runs-a-switched-off-template.sql, a-yearly-review-forgets-last-years-files.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.key', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Key Co', 'key_partner', true,
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.plain', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Plain Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

-- a monthly template for each key client, on the day ten days from now, with a two-row checklist
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.day', (core.riyadh_today() + 10)::text, true);
select set_config('t.tpl', api.task_template_save(null, jsonb_build_object('title', 'Made-up monthly feedback',
  'for_each', 'key_client', 'starts_on', core.riyadh_today(),
  'rule', jsonb_build_object('freq', 'monthly', 'month_day', extract(day from current_setting('t.day')::date)::int),
  'checklist', jsonb_build_array(jsonb_build_object('text', 'Made-up: call them', 'due_offset_days', 3),
                                 jsonb_build_object('text', 'Made-up: write it up', 'owner', current_setting('t.am2')))))
  ->> 'id', true);
-- an internal weekly one, made two days ahead, and one switched off, and one already ended
select set_config('t.wk', api.task_template_save(null, jsonb_build_object('title', 'Made-up weekly check',
  'work_type', 'internal', 'owner_id', current_setting('t.am2'), 'starts_on', core.riyadh_today(),
  'rule', jsonb_build_object('freq', 'weekly', 'lead_days', 2,
                             'weekdays', jsonb_build_array(extract(dow from current_setting('t.day')::date)::int))))
  ->> 'id', true);
select set_config('t.off', api.task_template_save(null, jsonb_build_object('title', 'Made-up switched off',
  'work_type', 'internal', 'owner_id', current_setting('t.am2'), 'starts_on', core.riyadh_today(), 'active', false,
  'rule', jsonb_build_object('freq', 'daily'))) ->> 'id', true);
select set_config('t.ended', api.task_template_save(null, jsonb_build_object('title', 'Made-up ended',
  'work_type', 'internal', 'owner_id', current_setting('t.am2'), 'starts_on', core.riyadh_today() - 30,
  'ends_on', core.riyadh_today() - 1, 'rule', jsonb_build_object('freq', 'daily'))) ->> 'id', true);
select test.as_owner();

-- eight days on: the weekly one is made for two days later; the monthly one not yet
select set_config('v2.test_now', (now() + interval '8 days')::text, true);
select work.generate_recurring();
select test.eq((select count(*)::int from work.task_occurrence o join work.task k on k.id = o.task_id
                where o.template_id = current_setting('t.wk')::uuid and k.due_on = current_setting('t.day')::date),
  1, 'a template with lead days is made that many days before its day');
select test.eq((select count(*)::int from work.task_occurrence where template_id = current_setting('t.tpl')::uuid), 0,
  'and not before');

-- on the day: one task for the key client, none for the other, however often the job runs
select set_config('v2.test_now', (now() + interval '10 days')::text, true);
select work.generate_recurring();
select work.generate_recurring();
select test.eq((select array_agg(o.partner_id) from work.task_occurrence o
                where o.template_id = current_setting('t.tpl')::uuid), array[current_setting('t.key')::uuid],
  'one task for each key client, once');
select set_config('t.t', (select o.task_id from work.task_occurrence o
                          where o.template_id = current_setting('t.tpl')::uuid)::text, true);
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid), current_setting('t.am1')::uuid,
  'owned by its account manager');
select test.eq((select row(title, due_on, happened_on, origin, work_type, partner_id)::text
                from work.task where id = current_setting('t.t')::uuid),
  row('Made-up monthly feedback', current_setting('t.day')::date, current_setting('t.day')::date, 'template', 'client',
      current_setting('t.key')::uuid)::text, 'titled, due on its day, made today, from the template');
select test.eq((select array_agg(a.owner_id order by a.sort) from work.action_item a
                where a.task_id = current_setting('t.t')::uuid),
  array[current_setting('t.am1')::uuid, current_setting('t.am2')::uuid], 'its checklist, each row its owner');
select test.eq((select a.due_on from work.action_item a where a.task_id = current_setting('t.t')::uuid and a.sort = 10),
  current_setting('t.day')::date + 3, 'a row due its days after the task is made');
select test.eq((select count(*)::int from notify.notification where kind = 'assigned'
                and entity_id = current_setting('t.t')::uuid and person_id = current_setting('t.am1')::uuid), 1,
  'its owner is told once');
select test.eq((select row(q.kind, q.actor_id, q.label_key)::text from audit.request q
                where q.id = (select c.request_id from audit.change c where c.row_id = current_setting('t.t')::uuid
                              order by c.id limit 1)),
  row('job', current_setting('t.admin')::uuid, 'task.generated')::text,
  'a job request, attributed to the template''s maker');
select test.eq((select count(*)::int from work.task_occurrence
                where template_id in (current_setting('t.off')::uuid, current_setting('t.ended')::uuid)), 0,
  'a template switched off or ended makes nothing');

-- nobody to own it: nothing is made, and nothing is taken — the next occurrence still comes. A person holding open work
-- is never switched off by a door (V452, V463, QA-523); they still end up inactive while holding it when a leaving day
-- arrives (the work stays for an admin to hand over), so for this step the guard is paused and the owner made inactive
-- directly, then both put back.
alter table core.person disable trigger keep_work;
update core.person set active = false where id = current_setting('t.am2')::uuid;
select set_config('v2.test_now', (now() + interval '15 days')::text, true);
select work.generate_recurring();
select test.eq((select count(*)::int from work.task_occurrence where template_id = current_setting('t.wk')::uuid), 1,
  'a switched-off owner gets nothing');
update core.person set active = true where id = current_setting('t.am2')::uuid;
alter table core.person enable trigger keep_work;
select set_config('v2.test_now', now()::text, true);

-- a yearly review over a side type links last year's files to this year's task
insert into partner.side_type (side, key, name_en, name_ar, sort)
values ('supplier_partner', 'test_accreditation', 'Test accreditation body', 'جهة اعتماد اختبار', 90);
select set_config('t.st', (select id from partner.side_type where key = 'test_accreditation')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.acc', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Accreditation Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'supplier_partner', 'type', 'test_accreditation',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.yr', api.task_template_save(null, jsonb_build_object('title', 'Made-up yearly review',
  'for_each', 'side_type', 'side_type_id', current_setting('t.st'),
  'attach_previous', true, 'starts_on', current_setting('t.day')::date,
  'rule', jsonb_build_object('freq', 'yearly'))) ->> 'id', true);
select test.as_owner();
select set_config('v2.test_now', (now() + interval '10 days')::text, true);
select work.generate_recurring();
select set_config('t.y1', (select task_id from work.task_occurrence where template_id = current_setting('t.yr')::uuid)::text,
  true);
insert into core.file (bucket, path, original_name, kind_id, mime, size_bytes)
values ('files', 'test/made-up-submission.pdf', 'made-up-submission.pdf', (select id from core.file_kind limit 1),
        'application/pdf', 100);
insert into core.file_link (file_id, entity_table, entity_id, purpose)
values ((select id from core.file where path = 'test/made-up-submission.pdf'), 'work.task',
        current_setting('t.y1')::uuid, 'attachment');
select set_config('v2.test_now', (now() + interval '10 days' + interval '1 year')::text, true);
select work.generate_recurring();
select test.eq((select count(*)::int from work.task_occurrence where template_id = current_setting('t.yr')::uuid), 2,
  'a year on, the next review');
select test.eq((select count(*)::int from core.file_link l join work.task_occurrence o on o.task_id = l.entity_id
                where o.template_id = current_setting('t.yr')::uuid and l.entity_id <> current_setting('t.y1')::uuid
                  and l.entity_table = 'work.task' and l.deleted_at is null), 1,
  'with last year''s files linked');
