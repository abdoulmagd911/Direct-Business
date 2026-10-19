-- NOTE-12 — V642: My team shows an admin the team notes of every team, never a private note. An admin with a home
-- team of their own sees the team notes of two other teams as well as their own; the private notes beside them reach
-- nobody but their authors; a member still sees only their own team's. Every value is made up; the day is the one after
-- the database is built (see NOTE-06).
-- Sabotage: supabase/tests/sabotage/an-admin-sees-only-their-own-team.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:00:00+03', true);
select set_config('t.dep', test.department('commercial')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'test_gamma', 'Test Gamma', 'فريق جاما'),
       (current_setting('t.dep')::uuid, 'test_delta', 'Test Delta', 'فريق دلتا'),
       (current_setting('t.dep')::uuid, 'test_home', 'Test Admin Home', 'فريق المدير');
select set_config('t.g', test.person('Test Gamma Writer', 'member')::text, true);
select set_config('t.d', test.person('Test Delta Writer', 'member')::text, true);
select set_config('t.h', test.person('Test Home Writer', 'member')::text, true);
select set_config('t.admin', test.person('Test Team Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_gamma') where id = current_setting('t.g')::uuid;
update core.person set team_id = (select id from core.team where code = 'test_delta') where id = current_setting('t.d')::uuid;
update core.person set team_id = (select id from core.team where code = 'test_home')
where id in (current_setting('t.h')::uuid, current_setting('t.admin')::uuid);

select test.as_person(current_setting('t.g')::uuid);
select set_config('t.gn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up gamma team note',
  'visibility', 'team')) ->> 'id', true);
select api.note_capture('sticky', jsonb_build_object('title', 'Made-up gamma private note'));
select test.as_person(current_setting('t.d')::uuid);
select set_config('t.dn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up delta team note',
  'visibility', 'team')) ->> 'id', true);
select api.note_capture('sticky', jsonb_build_object('title', 'Made-up delta private note'));
select test.as_person(current_setting('t.h')::uuid);
select set_config('t.hn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up home team note',
  'visibility', 'team')) ->> 'id', true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.seen', api.my_day('team')::text, true);
select test.eq((select array_agg(x ->> 'id' order by x ->> 'title') from jsonb_array_elements(current_setting('t.seen')::jsonb -> 'notes') x),
  array[current_setting('t.dn'), current_setting('t.gn'), current_setting('t.hn')],
  'an admin sees the team notes of every team, their own among them');
select test.eq((current_setting('t.seen')::jsonb ->> 'notes_total')::int, 3, 'and counts the same three');
select test.ok(position('private note' in current_setting('t.seen')) = 0, 'never a private note');

select test.as_person(current_setting('t.g')::uuid);
select test.eq(api.my_day('team') -> 'notes', '[]'::jsonb, 'a member still sees no other team''s notes');
