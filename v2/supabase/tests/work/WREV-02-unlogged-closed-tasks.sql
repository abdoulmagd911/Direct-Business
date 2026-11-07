-- WREV-02 — the Thursday review list (Phase 6). A done task with an achievement linked by source_task_id is not
-- listed; a done task without one is listed, this week's on top, then older ones below; another person's tasks are
-- excluded; Cancelled tasks are excluded; the cap is 50; routine tasks are excluded by default and show when asked;
-- a task dismissed with "Not an achievement" is excluded; "Later" hides a row until next Thursday. The bell answers
-- only on a Thursday in Riyadh and only in the hour of the nudge time read from settings (default 11:00), at most one
-- item per person per week. The backfill proposes same-owner, exact-title (case-insensitive, trimmed) matches within
-- 7 days after the task closed; confirming links, unconfirmed ones stay unlinked, a pair that no longer matches
-- links nothing. Days come from the test clock (Riyadh, D20): the week of Sunday 27 Sep 2026. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_wrev2', 'Test Weekly Nudge Desk', 'فريق التذكير الأسبوعي');
select set_config('t.own', test.person('Test Nudge Owner', 'member')::text, true);
select set_config('t.peer', test.person('Test Nudge Peer', 'member')::text, true);
select set_config('t.admin', test.person('Test Nudge Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_wrev2')
where id in (current_setting('t.own')::uuid, current_setting('t.peer')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.admin')::uuid);
-- the new kind entered the default after this test's clock, so the test turns it on for its own department explicitly
-- (a department row beats the global rows in core.setting_at)
insert into core.setting (key, department_id, value, valid_from, reason, created_by)
values ('notify.kinds_enabled', test.department('commercial'),
        (select default_value from core.setting_def where key = 'notify.kinds_enabled'),
        core.riyadh_today(), 'made up: the new weekly kind is on for this team',
        current_setting('t.admin')::uuid);
-- the nudge time defaults to 11:00 Riyadh
select test.eq((select default_value from core.setting_def where key = 'nudge.weekly_time'), '"11:00"'::jsonb,
  'the nudge time defaults to 11:00');

-- the admin makes the partner (side owned by the test owner) and opens the commercial plan; the owner makes the tasks
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Nudge Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.own'))))) ->> 'id', true);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.high', api.task_create(jsonb_build_object('title', 'Made-up high call', 'priority', 'high')) ->> 'id', true);
select set_config('t.partner', api.task_create(jsonb_build_object('title', 'Made-up partner visit', 'priority', 'low',
  'partner_id', current_setting('t.p'))) ->> 'id', true);
select set_config('t.logged', api.task_create(jsonb_build_object('title', 'Made-up logged call', 'priority', 'high')) ->> 'id', true);
select set_config('t.routine', api.task_create(jsonb_build_object('title', 'Made-up routine tidy', 'priority', 'low')) ->> 'id', true);
select set_config('t.dismissed', api.task_create(jsonb_build_object('title', 'Made-up dismissed call', 'priority', 'high')) ->> 'id', true);
select set_config('t.cancelled', api.task_create(jsonb_build_object('title', 'Made-up cancelled call', 'priority', 'high')) ->> 'id', true);
select api.task_status_set(current_setting('t.high')::uuid, 'done');
select api.task_status_set(current_setting('t.partner')::uuid, 'done');
select api.task_status_set(current_setting('t.logged')::uuid, 'done');
select api.task_status_set(current_setting('t.routine')::uuid, 'done');
select api.task_status_set(current_setting('t.dismissed')::uuid, 'done');
select api.task_status_set(current_setting('t.cancelled')::uuid, 'cancelled');
-- the logged one already has its achievement, linked by source_task_id
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up logged work',
  'happened_on', '2026-10-01', 'source_task_id', current_setting('t.logged'))) ->> 'id', true);
-- the dismissed one is put off the nudge with "Not an achievement"
select api.task_nudge_dismiss(current_setting('t.dismissed')::uuid, true);

-- a colleague makes and closes their own high-priority task
select test.as_person(current_setting('t.peer')::uuid);
select set_config('t.other', api.task_create(jsonb_build_object('title', 'Made-up peer call', 'priority', 'high')) ->> 'id', true);
select api.task_status_set(current_setting('t.other')::uuid, 'done');

-- and one task closed last week (Thursday 24 Sep, the week before)
select set_config('v2.test_now', '2026-09-24 09:00:00+03', true);
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.old', api.task_create(jsonb_build_object('title', 'Made-up older call', 'priority', 'high')) ->> 'id', true);
select api.task_status_set(current_setting('t.old')::uuid, 'done');
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);

-- the list: the high-priority one, the partner-linked one, the older one — and nothing else
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.u', api.weekly_unlogged()::text, true);
select test.eq((current_setting('t.u')::jsonb ->> 'total')::int, 3,
  'unlogged: the high-priority one, the partner-linked one and the older one');
select test.eq((select jsonb_agg(r ->> 'task_id') from jsonb_array_elements(current_setting('t.u')::jsonb -> 'rows') r),
  jsonb_build_array(current_setting('t.high'), current_setting('t.partner'), current_setting('t.old')),
  'this week''s on top, then the older one below');
select test.eq((current_setting('t.u')::jsonb -> 'rows' -> 0 ->> 'this_week')::boolean, true,
  'this week''s rows say so');
select test.eq((current_setting('t.u')::jsonb -> 'rows' -> 2 ->> 'this_week')::boolean, false,
  'and the older one does not');
select test.eq(current_setting('t.u')::jsonb -> 'rows' -> 2 ->> 'day', '2026-09-24', 'on its own closed day');
select test.eq((api.weekly_unlogged(true) ->> 'total')::int, 4, 'routine tasks show when asked for');
select test.ok(position(current_setting('t.routine') in api.weekly_unlogged(true)::text) > 0,
  'the routine one among them');

-- another person's tasks stay theirs
select test.as_person(current_setting('t.peer')::uuid);
select test.eq((api.weekly_unlogged() ->> 'total')::int, 1, 'another person''s list holds only their own');
select test.eq(api.weekly_unlogged() -> 'rows' -> 0 ->> 'task_id', current_setting('t.other'), 'the peer''s own one');

-- "Later" hides the row until next Thursday
select test.as_person(current_setting('t.own')::uuid);
select api.task_nudge_later(current_setting('t.high')::uuid);
select test.eq((api.weekly_unlogged() ->> 'total')::int, 2, '"Later" hides the row until next Thursday');
select set_config('v2.test_now', '2026-10-08 09:00:00+03', true);
select test.eq((api.weekly_unlogged() ->> 'total')::int, 3, 'next Thursday it is back');
select test.eq((select (r ->> 'this_week')::boolean from jsonb_array_elements(api.weekly_unlogged() -> 'rows') r
                where r ->> 'task_id' = current_setting('t.high')), false, 'standing below this week''s now');
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);

-- the bell: nothing outside the nudge hour, one item per person per week at 11:00 on a Thursday
select set_config('v2.test_now', '2026-10-01 10:00:00+03', true);
select test.as_owner();
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_weekly_unlogged'), 0,
  'outside the nudge hour the alert answers nothing');
select set_config('v2.test_now', '2026-10-01 11:00:00+03', true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.own')::uuid), 1, 'at 11:00 on Thursday the owner is told once');
select test.eq((select count(*)::int from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.peer')::uuid), 1, 'and the colleague with unlogged work is told too');
select test.eq((select label_args ->> 'count' from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.own')::uuid), '2', 'the owner''s item counts their unlogged tasks');
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.own')::uuid), 1, 'a second run in the same hour makes nothing new');
select set_config('v2.test_now', '2026-10-02 11:00:00+03', true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.own')::uuid), 1, 'Friday makes nothing new');
select set_config('v2.test_now', '2026-10-08 11:00:00+03', true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.own')::uuid), 2, 'next Thursday brings the week''s one item');
select test.eq((select label_args ->> 'count' from notify.notification where kind = 'alert_weekly_unlogged'
                and person_id = current_setting('t.own')::uuid and alert_day = '2026-10-08'), '3',
  'now counting the task that came back from "Later"');

-- the nudge hour is read from settings at run time, never hard-coded: with the hour moved to 14:00, 11:00 answers
-- nothing and 14:00 answers for both people with unlogged work
select test.as_owner();
insert into core.setting (key, value, valid_from, reason, created_by)
values ('nudge.weekly_time', to_jsonb('14:00'::text), '2026-10-08', 'made up: a later nudge hour',
        current_setting('t.admin')::uuid);
select set_config('v2.test_now', '2026-10-08 11:00:00+03', true);
select test.eq((select count(*)::int from notify.alert_weekly_unlogged()), 0,
  'with the hour moved to 14:00, 11:00 answers nothing');
select set_config('v2.test_now', '2026-10-08 14:00:00+03', true);
select test.eq((select count(*)::int from notify.alert_weekly_unlogged()), 2,
  'and 14:00 answers for both people with unlogged work');

-- the one-off backfill: two closed tasks and two achievements with the same titles, days apart
select set_config('v2.test_now', '2026-09-28 09:00:00+03', true);
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.bf', api.task_create(jsonb_build_object('title', 'Made-up Backfill Work', 'priority', 'high')) ->> 'id', true);
select api.task_status_set(current_setting('t.bf')::uuid, 'done');
select set_config('v2.test_now', '2026-09-29 09:00:00+03', true);
select set_config('t.bf2', api.task_create(jsonb_build_object('title', 'Made-up Second Backfill', 'priority', 'high')) ->> 'id', true);
select api.task_status_set(current_setting('t.bf2')::uuid, 'done');
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.abf', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', '  made-up backfill work  ',
  'happened_on', '2026-09-30')) ->> 'id', true);
select set_config('t.abf2', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-Up Second Backfill',
  'happened_on', '2026-10-01')) ->> 'id', true);
select set_config('t.aother', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up unrelated work',
  'happened_on', '2026-10-01')) ->> 'id', true);
select test.eq((select jsonb_agg(p ->> 'task_id' order by p ->> 'task_id')
                from jsonb_array_elements(api.backfill_proposals()) p),
  (select jsonb_agg(x order by x) from unnest(array[current_setting('t.bf'), current_setting('t.bf2')]) x),
  'proposals: the two matching pairs, nothing else');
select api.backfill_confirm(current_setting('t.bf')::uuid, current_setting('t.abf')::uuid);
select test.as_owner();
select test.eq((select source_task_id::text from perf.achievement where id = current_setting('t.abf')::uuid),
  current_setting('t.bf'), 'confirming links the achievement to the task');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.weekly_unlogged() ->> 'total')::int, 3,
  'and the confirmed task leaves the unlogged list');
select test.raises(format('select api.backfill_confirm(%L, %L)', current_setting('t.bf2'), current_setting('t.aother')),
  'P0001', 'a pair that does not match links nothing', 'backfill.no_match');
select test.raises(format('select api.backfill_confirm(%L, %L)', current_setting('t.bf'), current_setting('t.abf')),
  'P0001', 'an already confirmed pair cannot confirm again', 'backfill.no_match');
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.backfill_confirm(%L, %L)', current_setting('t.bf2'), current_setting('t.abf2')),
  'P0002', 'another person''s pair is not theirs to confirm', 'common.not_found');
select test.as_owner();
select test.eq((select source_task_id from perf.achievement where id = current_setting('t.abf2')::uuid), null::uuid,
  'the unconfirmed one stays unlinked');
select test.as_person(current_setting('t.own')::uuid);
select test.ok(position(current_setting('t.bf2') in api.backfill_proposals()::text) > 0, 'and stays proposed');

-- the cap: 51 more unlogged tasks, and the list still returns 50
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.cap', (select coalesce(jsonb_agg((api.task_create(jsonb_build_object('title', 'Made-up cap task ' || g,
  'priority', 'high')) ->> 'id') order by g)::text, '[]') from generate_series(1, 51) g), true);
select api.task_status_set(x::uuid, 'done') from jsonb_array_elements_text(current_setting('t.cap')::jsonb) x;
select test.eq((api.weekly_unlogged() ->> 'total')::int, 54, 'the list counts past its cap');
select test.eq(jsonb_array_length(api.weekly_unlogged() -> 'rows'), 50, 'and returns at most 50 rows');

select set_config('v2.test_now', '', true);
