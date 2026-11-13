-- NOTE-15 — D-myday (13 Nov): My team's Deferred list and "What's new" follow the team tab's own rule (V524, V642). A note
-- carried to a later day is on the reader's Deferred list exactly when My team would show it today: a teammate's team
-- note, a note shared with them by name, and — for an admin — the team notes of every team; never a private note, nor one
-- shared by name with someone else. "What's new" counts a note shared by name as shared with you, never as a note for
-- everyone. Every value is made up; the day is a Thursday on the test clock, so a carried note lands on the Sunday. The
-- checks name this test's own notes, so other notes in a shared local database do not move them.
select set_config('v2.test_now', '2026-10-01 18:00:00+03', true);
select set_config('t.dep', test.department('commercial')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'test_defer_a', 'Test Defer A', 'فريق التأجيل أ'),
       (current_setting('t.dep')::uuid, 'test_defer_b', 'Test Defer B', 'فريق التأجيل ب');
select set_config('t.author', test.person('Test Defer Author', 'member')::text, true);
select set_config('t.mate', test.person('Test Defer Teammate', 'member')::text, true);
select set_config('t.named', test.person('Test Defer Named', 'member')::text, true);
select set_config('t.admin', test.person('Test Defer Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_defer_a')
where id in (current_setting('t.author')::uuid, current_setting('t.mate')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_defer_b')
where id in (current_setting('t.named')::uuid, current_setting('t.admin')::uuid);

-- the author writes a team note, a note shared by name and a private note, and carries all three to Sunday
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.tn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up deferred team note',
  'visibility', 'team')) ->> 'id', true);
select set_config('t.pn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up deferred shared note',
  'visibility', 'person', 'shared_with', current_setting('t.named'))) ->> 'id', true);
select set_config('t.xn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up deferred private note')) ->> 'id',
  true);
select api.note_wrap_up('2026-10-01', jsonb_build_array(
  jsonb_build_object('note', current_setting('t.tn'), 'choice', 'carry'),
  jsonb_build_object('note', current_setting('t.pn'), 'choice', 'carry'),
  jsonb_build_object('note', current_setting('t.xn'), 'choice', 'carry')));
select test.eq(api.my_note(current_setting('t.pn')::uuid) ->> 'carried_to', '2026-10-04', 'carried over to Sunday');

-- what each reader's My team tab answers, read as them
select test.as_person(current_setting('t.mate')::uuid);
select set_config('t.mate_team', api.my_day('team')::text, true);
select test.as_person(current_setting('t.named')::uuid);
select set_config('t.named_team', api.my_day('team')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.admin_team', api.my_day('team')::text, true);
select test.as_owner();
-- which of this test's three notes (team, shared, private) an answer's Deferred list holds
create function pg_temp.deferred_of(answer text) returns text[]
language sql as $$
  select array(select n from unnest(array[current_setting('t.tn'), current_setting('t.pn'), current_setting('t.xn')])
               with ordinality u(n, i)
               where exists (select 1 from jsonb_array_elements(answer::jsonb -> 'deferred') x where x ->> 'id' = n)
               order by i)
$$;
select test.eq(pg_temp.deferred_of(current_setting('t.mate_team')), array[current_setting('t.tn')],
  'a teammate finds the team note deferred, not the note shared with someone else nor the private one');
select test.eq(pg_temp.deferred_of(current_setting('t.named_team')), array[current_setting('t.pn')],
  'the colleague named on a note finds it deferred with their team''s notes');
select test.eq(pg_temp.deferred_of(current_setting('t.admin_team')), array[current_setting('t.tn')],
  'an admin of another team finds the deferred team note, never the shared or the private one');

-- What's new, on the Sunday the notes come back: a note shared by name is shared with you, a team note is the team's
select set_config('v2.test_now', '2026-10-04 09:00:00+03', true);
select test.as_person(current_setting('t.named')::uuid);
select set_config('t.named_since', (api.my_day('me', 7, 0, '2026-09-30 00:00:00+03') -> 'since')::text, true);
select test.as_person(current_setting('t.mate')::uuid);
select set_config('t.mate_since', (api.my_day('me', 7, 0, '2026-09-30 00:00:00+03') -> 'since')::text, true);
select test.as_owner();
create function pg_temp.since_count(since text, kind text) returns int
language sql as $$
  select coalesce((select (x ->> 'count')::int from jsonb_array_elements(since::jsonb) x where x ->> 'kind' = kind), 0)
$$;
select test.eq(pg_temp.since_count(current_setting('t.named_since'), 'shared_notes'), 1,
  'a note shared by name is counted as shared with you');
select test.eq(pg_temp.since_count(current_setting('t.named_since'), 'workspace_notes'),
  pg_temp.since_count(current_setting('t.mate_since'), 'workspace_notes'),
  'and never as a note for everyone (the named colleague counts no more of those than the teammate)');
select test.ok(pg_temp.since_count(current_setting('t.mate_since'), 'team_notes') >= 1,
  'a team note is counted as the team''s');
