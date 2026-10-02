-- MSR-02 — the weekly measures (TECH-SPEC §3.8; V42, V63, V400): work.weekly_updates — per person and working week
-- (Sunday to Thursday), counted when every task they had In progress on its Thursday had an update that week, a week
-- with nothing in progress not judged; work.pipeline_updates — per person and working week while they are with the
-- team, counted when their task updates and logged calls reach the weekly target. Weeks are judged once over; by
-- `happened_on`. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-week-counts-with-one-task-updated.sql, a-week-with-nothing-in-progress-is-judged.sql,
-- pipeline-updates-ignore-calls.sql, pipeline-updates-ignore-the-target.sql, weeks-before-joining-are-judged.sql,
-- the-working-week-starts-on-monday.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.team', (select id from core.team where code = 'test_desk')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = current_setting('t.team')::uuid
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);
-- week A starts on the Sunday two weeks back; week B the Sunday after; both are over
select set_config('t.ws', (measure.week_start(core.riyadh_today()) - 14)::text, true);
select test.eq(extract(dow from current_setting('t.ws')::date)::int, 0, 'a working week starts on Sunday');

-- am1: W1 and W2 In progress through both weeks, W3 done before them
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.W1', api.task_create(jsonb_build_object('title', 'Made-up W1', 'happened_on',
  current_setting('t.ws')::date - 3)) ->> 'id', true);
select set_config('t.W2', api.task_create(jsonb_build_object('title', 'Made-up W2', 'happened_on',
  current_setting('t.ws')::date - 3)) ->> 'id', true);
select set_config('t.W3', api.task_create(jsonb_build_object('title', 'Made-up W3', 'happened_on',
  current_setting('t.ws')::date - 5)) ->> 'id', true);
select api.task_status_set(current_setting('t.W1')::uuid, 'in_progress', current_setting('t.ws')::date - 2);
select api.task_status_set(current_setting('t.W2')::uuid, 'in_progress', current_setting('t.ws')::date - 2);
select api.task_status_set(current_setting('t.W3')::uuid, 'done', current_setting('t.ws')::date - 4);
-- week A: both updated (Monday, Tuesday); week B: only W1 (Monday)
select api.note_add('task', current_setting('t.W1')::uuid, 'update', 'Made-up progress', current_setting('t.ws')::date + 1);
select api.note_add('task', current_setting('t.W2')::uuid, 'update', 'Made-up progress', current_setting('t.ws')::date + 2);
select api.note_add('task', current_setting('t.W1')::uuid, 'update', 'Made-up progress', current_setting('t.ws')::date + 8);
select test.as_owner();

select test.eq(measure.work_weekly_updates(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(0.5000,t,2)',
  'weekly updates: week A, every task in progress updated, counts; week B, one left without, does not');
select test.eq((select array_agg(i.happened_on order by i.happened_on) from measure.work_weekly_updates_items(null,
                  'person', current_setting('t.am1')::uuid, current_setting('t.ws')::date,
                  current_setting('t.ws')::date + 11) i where i.counted),
  array[current_setting('t.ws')::date], 'the drill-down names week A');
select test.eq(measure.work_weekly_updates(null, 'person', current_setting('t.am2')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(,f,0)',
  'nothing in progress: not measured');
select test.eq(measure.work_weekly_updates(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.ws')::date + 21, current_setting('t.ws')::date + 40)::text, '(,f,0)',
  'a week not over yet (next week) is not judged');

-- pipeline updates: every task update counts, and every logged call
select test.eq(measure.work_pipeline_updates(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(1.0000,t,2)',
  'am1 reached the weekly target in both weeks');
select test.eq(measure.work_pipeline_updates('{"weekly_target": 2}', 'person', current_setting('t.am1')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(0.5000,t,2)',
  'with a target of two, only week A');
select test.eq(measure.work_pipeline_updates(null, 'person', current_setting('t.am2')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(0.0000,t,2)',
  'am2 logged nothing: both weeks missed');
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Calls Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am2'))))) ->> 'id', true);
select api.activity_log(current_setting('t.p')::uuid, 'call', 'no_answer', current_setting('t.ws')::date + 8);
select test.as_owner();
select test.eq(measure.work_pipeline_updates(null, 'person', current_setting('t.am2')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(0.5000,t,2)',
  'a logged call counts: week B reached');
update core.person set joined_on = current_setting('t.ws')::date + 5 where id = current_setting('t.am2')::uuid;
select test.eq(measure.work_pipeline_updates(null, 'person', current_setting('t.am2')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(1.0000,t,1)',
  'a week before the person joined is not judged');
select test.eq(measure.work_pipeline_updates(null, 'team', current_setting('t.team')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(1.0000,t,3)',
  'the team: each member''s weeks');
select test.eq(measure.work_pipeline_updates(null, 'partner', current_setting('t.p')::uuid,
  current_setting('t.ws')::date, current_setting('t.ws')::date + 11)::text, '(,f,0)',
  'an organisation is not a scope of people: not measured');
