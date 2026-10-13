-- CTR-04 — the contract renewal task (V56; TECH-SPEC §3.4). At a contract's first reminder the daily job makes one
-- renewal task for its side's owner — due on the end date, made that day, origin alert, linked to the contract, its owner
-- told once — however often it runs; none before the first reminder (never one from before the contract was added),
-- none when its reminders are off, none for an open-ended contract, none while partner.contract_renewal_task is off; a
-- renewed end date gets its own once the last one is closed; the reminder names it. Create renewal task: a person
-- presses it, one request with its Undo; never a second while one is open; only whoever may change the contract. Every
-- value is made up.
-- Sabotages: supabase/tests/sabotage/the-renewal-task-is-made-twice.sql, the-renewal-task-ignores-the-setting.sql,
-- a-renewal-task-before-the-first-reminder.sql, a-renewed-contract-gets-no-renewal-task.sql,
-- the-reminder-forgets-its-renewal-task.sql.
select set_config('v2.test_now', now()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Other Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
select set_config('t.d0', core.riyadh_today()::text, true);

-- A reaches its 30-day reminder today; B tomorrow; C has its reminders off; D its own reminder in five days; E has no
-- end; F was added after its 60- and 30-day reminders, so its first is the 7-day one.
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Renewals Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.a', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up A', 'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 30))
  ->> 'id', true);
select set_config('t.b', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up B', 'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 31))
  ->> 'id', true);
select set_config('t.c', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up C', 'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 20,
  'reminders_on', false)) ->> 'id', true);
select set_config('t.d', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up D', 'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 10,
  'reminder_days', '[5]'::jsonb)) ->> 'id', true);
select set_config('t.e', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up E', 'start_on', current_setting('t.d0')::date - 300)) ->> 'id', true);
select set_config('t.f', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up F', 'start_on', current_setting('t.d0')::date - 300, 'end_on', current_setting('t.d0')::date + 20))
  ->> 'id', true);

-- today: A alone
select test.as_owner();
select test.eq(work.make_renewal_tasks(), 1, 'today: one renewal task, for the contract at its first reminder');
select set_config('t.ta', (select renewal_task_id from partner.contract where id = current_setting('t.a')::uuid)::text,
  true);
select test.eq((select row(t.title, t.owner_id, t.due_on, t.happened_on, t.origin, t.partner_id, ty.key)::text
                from work.task t join work.task_type ty on ty.id = t.type_id where t.id = current_setting('t.ta')::uuid),
  row('Renewal · Made-up A', current_setting('t.am1')::uuid, current_setting('t.d0')::date + 30,
      current_setting('t.d0')::date, 'alert', current_setting('t.p')::uuid, 'follow_up')::text,
  'the account manager''s, due on the end date, made today, from the alert, on the organisation');
select test.eq((select renewal_end_on from partner.contract where id = current_setting('t.a')::uuid),
  current_setting('t.d0')::date + 30, 'linked to the contract, for this end date');
select test.eq((select count(*)::int from notify.notification where kind = 'assigned'
                and entity_id = current_setting('t.ta')::uuid and person_id = current_setting('t.am1')::uuid), 1,
  'its owner is told once');
select test.eq((select row(q.kind, q.actor_id = core.system_person_id())::text from audit.request q
                where q.id = (select c.request_id from audit.change c where c.row_id = current_setting('t.ta')::uuid
                              order by c.id limit 1)), row('job', true)::text, 'a job request');
select test.eq(work.make_renewal_tasks(), 0, 'a second run the same day makes nothing');
select notify.generate_alerts();
select test.eq((select label_args ->> 'renewal_task_id' from notify.notification where kind = 'alert_contract_expiring'
                and entity_id = current_setting('t.a')::uuid and person_id = current_setting('t.am1')::uuid),
  current_setting('t.ta'), 'the reminder names its renewal task');

-- tomorrow: B; A's is open
select set_config('v2.test_now', (now() + interval '1 day')::text, true);
select test.eq(work.make_renewal_tasks(), 1, 'tomorrow: B at its first reminder, and A not again');
select test.ok((select renewal_task_id is not null from partner.contract where id = current_setting('t.b')::uuid), 'B''s');

-- five days on, D's own reminder day: nothing while the setting is off; D when it is back on
select set_config('v2.test_now', (now() + interval '5 days')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('partner.contract_renewal_task', null, 'false', null, 'Made-up: by hand for now');
select test.as_owner();
select test.eq(work.make_renewal_tasks(), 0, 'the setting off: none, not even D on its own day');
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('partner.contract_renewal_task', null, 'true', null, 'Made-up: back on');
select test.as_owner();
select test.eq(work.make_renewal_tasks(), 1, 'back on: D, its own reminder day reached');
select test.eq((select count(*)::int from partner.contract where renewal_task_id is not null
                and id in (current_setting('t.c')::uuid, current_setting('t.e')::uuid, current_setting('t.f')::uuid)), 0,
  'never one with its reminders off, nor one with no end, nor one before its first reminder');

-- A renewed: no second while its renewal task is open; once it is done, the new end date gets its own
select set_config('t.av', (select version from partner.contract where id = current_setting('t.a')::uuid)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.contract_save(current_setting('t.p')::uuid, current_setting('t.a')::uuid,
  jsonb_build_object('end_on', current_setting('t.d0')::date + 35), current_setting('t.av')::int);
select test.as_owner();
select test.eq(work.make_renewal_tasks(), 0, 'renewed while its renewal task is open: not a second');
select test.as_person(current_setting('t.am1')::uuid);
select api.task_status_set(current_setting('t.ta')::uuid, 'done');
select test.as_owner();
select test.eq(work.make_renewal_tasks(), 1, 'its renewal task done: the new end date gets its own');
select test.eq((select row(renewal_task_id <> current_setting('t.ta')::uuid, renewal_end_on)::text
                from partner.contract where id = current_setting('t.a')::uuid),
  row(true, current_setting('t.d0')::date + 35)::text, 'linked to the new one');

-- Create renewal task, pressed on C (its reminders off) — back on today's clock, inside the Undo window
select set_config('v2.test_now', now()::text, true);
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.contract_renewal_task(%L)', current_setting('t.c')), '42501',
  'only whoever may change the contract', 'access.needs_level');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.contract_renewal_task(%L)', current_setting('t.c')), '42501',
  'making it for its owner needs Assign, as any task', 'access.needs_capability');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.contract_renewal_task(%L)', current_setting('t.e')), 'P0001',
  'never for a contract with no end', 'contract.renewal_needs_end_date');
select set_config('t.rc', api.contract_renewal_task(current_setting('t.c')::uuid)::text, true);
select set_config('t.tc', current_setting('t.rc')::jsonb ->> 'id', true);
select test.raises(format('select api.contract_renewal_task(%L)', current_setting('t.c')), 'P0001',
  'never a second while one is open', 'contract.renewal_task_open');
select test.as_owner();
select test.eq((select row(t.title, t.owner_id, t.due_on, t.origin)::text from work.task t
                where t.id = current_setting('t.tc')::uuid),
  row('Renewal · Made-up C', current_setting('t.am1')::uuid, current_setting('t.d0')::date + 20, 'manual')::text,
  'pressed: the account manager''s, due on the end date');
select test.eq((select renewal_task_id::text from partner.contract where id = current_setting('t.c')::uuid),
  current_setting('t.tc'), 'linked to the contract');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.rc')::jsonb ->> 'request_id'), 'Undo');
select test.as_owner();
select test.eq((select row(renewal_task_id is null, renewal_end_on is null)::text from partner.contract
                where id = current_setting('t.c')::uuid), row(true, true)::text, 'one Undo takes back the link');
select test.eq((select count(*)::int from work.task where id = current_setting('t.tc')::uuid and deleted_at is null), 0,
  'and the task');
