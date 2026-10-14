-- WREV-01 — the Thursday weekly review (V632 Stage 3): one read of my own week. Done holds what I completed (a dropped
-- task or note is not done); Slipped holds what is still open and was carried over this week or is overdue, with how
-- often I carried it, most carried first; Next holds what is due next week; Notes is a short list of my notes this week,
-- my private ones included. A private note stays its author's alone (V454): a colleague's and an admin's review hold
-- nothing of it, and the read takes no person to look someone else up. Days come from the test clock (Riyadh, D20):
-- the week of Sunday 18 Oct 2026. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-weekly-review-shows-an-admin-everyones-notes.sql,
-- supabase/tests/sabotage/a-weekly-review-counts-a-dropped-task-as-done.sql.
select set_config('t.admin', test.person('Test Review Admin', 'admin')::text, true);
select set_config('t.am', test.person('Test Review Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Review Colleague', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_wrev', 'Test Review Desk', 'فريق المراجعة');
update core.person set team_id = (select id from core.team where code = 'test_wrev')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid, current_setting('t.admin')::uuid);

-- Sunday: the week's work is made, and the first wrap-up
select set_config('v2.test_now', '2026-10-18 10:00:00+03', true);
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.done', api.task_create(jsonb_build_object('title', 'Made-up finished call', 'due_on', '2026-10-18')) ->> 'id', true);
select set_config('t.carry', api.task_create(jsonb_build_object('title', 'Made-up twice moved', 'due_on', '2026-10-18')) ->> 'id', true);
select set_config('t.drop', api.task_create(jsonb_build_object('title', 'Made-up dropped idea', 'due_on', '2026-10-18')) ->> 'id', true);
select set_config('t.over', api.task_create(jsonb_build_object('title', 'Made-up overdue visit', 'due_on', '2026-10-19')) ->> 'id', true);
select set_config('t.next', api.task_create(jsonb_build_object('title', 'Made-up next week quote', 'due_on', '2026-10-27')) ->> 'id', true);
select set_config('t.far', api.task_create(jsonb_build_object('title', 'Made-up far away', 'due_on', '2026-11-20')) ->> 'id', true);
select set_config('t.npriv', api.note_capture('idea', jsonb_build_object('title', 'Zebracorn weekly secret')) ->> 'id', true);
select set_config('t.ncarry', api.note_capture('sticky', jsonb_build_object('title', 'Made-up carried thought')) ->> 'id', true);
select set_config('t.ndone', api.note_capture('sticky', jsonb_build_object('title', 'Made-up finished thought')) ->> 'id', true);
select set_config('t.ndrop', api.note_capture('sticky', jsonb_build_object('title', 'Made-up dropped thought')) ->> 'id', true);
select api.wrap_up(jsonb_build_array(
  jsonb_build_object('kind', 'task', 'id', current_setting('t.done'), 'choice', 'done'),
  jsonb_build_object('kind', 'task', 'id', current_setting('t.carry'), 'choice', 'tomorrow'),
  jsonb_build_object('kind', 'task', 'id', current_setting('t.drop'), 'choice', 'drop'),
  jsonb_build_object('kind', 'note', 'id', current_setting('t.ncarry'), 'choice', 'tomorrow'),
  jsonb_build_object('kind', 'note', 'id', current_setting('t.ndone'), 'choice', 'done'),
  jsonb_build_object('kind', 'note', 'id', current_setting('t.ndrop'), 'choice', 'drop')));

select test.as_person(current_setting('t.am2')::uuid);
select api.note_capture('sticky', jsonb_build_object('title', 'Quagga colleague secret'));

-- Monday: the same task carried again
select set_config('v2.test_now', '2026-10-19 17:00:00+03', true);
select test.as_person(current_setting('t.am')::uuid);
select api.wrap_up(jsonb_build_array(jsonb_build_object('kind', 'task', 'id', current_setting('t.carry'), 'choice', 'tomorrow')));

-- Thursday: the review
select set_config('v2.test_now', '2026-10-22 15:00:00+03', true);
select set_config('t.r', api.weekly_review()::text, true);
select test.eq(current_setting('t.r')::jsonb -> 'week', '{"from": "2026-10-18", "to": "2026-10-24"}'::jsonb,
  'the week runs from its Sunday');
select test.eq(current_setting('t.r')::jsonb -> 'next_week', '{"from": "2026-10-25", "to": "2026-10-31"}'::jsonb,
  'and next week follows it');
select test.eq((select jsonb_agg(r ->> 'id' order by r ->> 'id') from jsonb_array_elements(current_setting('t.r')::jsonb -> 'done' -> 'rows') r),
  (select jsonb_agg(x order by x) from unnest(array[current_setting('t.done'), current_setting('t.ndone')]) x),
  'done: the finished task and note, never the dropped ones');
select test.eq((select jsonb_agg(jsonb_build_array(r ->> 'id', (r ->> 'times')::int))
                from jsonb_array_elements(current_setting('t.r')::jsonb -> 'slipped' -> 'rows') r),
  jsonb_build_array(jsonb_build_array(current_setting('t.carry'), 2), jsonb_build_array(current_setting('t.ncarry'), 1),
                    jsonb_build_array(current_setting('t.over'), 0)),
  'slipped: still open, carried or overdue, most carried first, with how often');
select test.eq((select jsonb_agg(r ->> 'id') from jsonb_array_elements(current_setting('t.r')::jsonb -> 'next' -> 'rows') r),
  jsonb_build_array(current_setting('t.next')), 'next: only what is due next week');
select test.eq((current_setting('t.r')::jsonb -> 'notes' ->> 'total')::int, 4, 'notes: my four notes this week');
select test.ok(position('Zebracorn' in current_setting('t.r')) > 0, 'my own private idea is on my review');
select test.ok(position('Quagga' in current_setting('t.r')) = 0, 'a colleague''s private note is not');

-- a private note stays its author's: a colleague and an admin see nothing of it
select test.as_person(current_setting('t.am2')::uuid);
select test.ok(position('Zebracorn' in api.weekly_review()::text) = 0, 'a colleague''s review holds nothing of it');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.ra', api.weekly_review()::text, true);
select test.ok(position('Zebracorn' in current_setting('t.ra')) = 0 and position('Quagga' in current_setting('t.ra')) = 0,
  'nor an admin''s');
select test.eq((current_setting('t.ra')::jsonb -> 'notes' ->> 'total')::int, 0, 'an admin''s review counts only their own notes');
select test.raises($$select api.weekly_review(p_day => null, p_person => current_setting('t.am')::uuid)$$, '42883',
  'and the read takes no person to look someone else up');

-- another week is its own
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.prev', api.weekly_review('2026-10-15')::text, true);
select test.eq((current_setting('t.prev')::jsonb -> 'done' ->> 'total')::int + (current_setting('t.prev')::jsonb -> 'notes' ->> 'total')::int,
  0, 'the week before holds none of it');
select set_config('v2.test_now', '', true);
