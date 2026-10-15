-- NTF-07 — a reminder alert names what it reminds of (the supervisor's production sweep of 15 Oct, item 2: a bell row
-- read "Reminder: Reminder"). A reminder on a titled note reads by the note's title; on an untitled note, by the
-- note's first line; with no note, by its own first line — never by the word "Reminder" alone. Someone else's reminder
-- names nothing. Every value is made up; the day is the one after the database is built (see NOTE-06).
-- Sabotage: supabase/tests/sabotage/a-reminder-alert-names-nothing.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:50:00+03', true);
select set_config('t.am', test.person('Test Reminder Owner', 'member')::text, true);
select set_config('t.other', test.person('Test Other Member', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.titled', api.note_capture('sticky', jsonb_build_object('title', 'Made-up ring the supplier')) ->> 'id', true);
select set_config('t.r1', api.note_turn_into(current_setting('t.titled')::uuid, 'reminder',
  jsonb_build_object('remind_at', current_setting('t.d1') || ' 10:00:00+03')) ->> 'id', true);
select set_config('t.untitled', api.note_capture('sticky',
  jsonb_build_object('body', E'  Made-up send the visa list  \nand a second line')) ->> 'id', true);
select set_config('t.r2', api.note_turn_into(current_setting('t.untitled')::uuid, 'reminder',
  jsonb_build_object('remind_at', current_setting('t.d1') || ' 10:00:00+03')) ->> 'id', true);

select test.as_owner();
select set_config('v2.test_now', current_setting('t.d1') || ' 10:05:00+03', true);
select test.eq(notify.send_reminders(), 2, 'both reminders go out');

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.bell', api.notifications()::text, true);
select test.eq((select x ->> 'title' from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'entity_id' = current_setting('t.r1')), 'Made-up ring the supplier',
  'a reminder on a titled note reads by the title');
select test.eq((select x ->> 'title' from jsonb_array_elements(current_setting('t.bell')::jsonb) x
                where x ->> 'entity_id' = current_setting('t.r2')), 'Made-up send the visa list',
  'on an untitled note, by its first line');

-- someone else's reminder names nothing, even if a notice of it reached them
select test.as_owner();
select test.eq(notify.first_line(E'\n\n  Made-up first words  \nmore'), 'Made-up first words',
  'the first line skips blank lines and spaces');
select test.eq(notify.first_line('   '), null::text, 'and is nothing for nothing');
insert into notify.notification (person_id, kind, entity_table, entity_id, label_key)
values (current_setting('t.other')::uuid, 'reminder', 'core.reminder', current_setting('t.r1')::uuid, 'notify.reminder');
select test.as_person(current_setting('t.other')::uuid);
select test.eq((select x ->> 'title' from jsonb_array_elements(api.notifications()) x
                where x ->> 'entity_id' = current_setting('t.r1')), null::text,
  'another person''s reminder names nothing');
