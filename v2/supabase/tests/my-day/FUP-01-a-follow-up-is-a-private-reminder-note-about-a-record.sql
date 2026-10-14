-- FUP-01 — a follow-up is a private "Only me" Reminder note about a record (V632 Stage 2; the Architect's ruling of
-- 14 Oct): captured with what it is about (a client, a task or an invoice), it is private by default, says what it is
-- about wherever its author reads it — the note, My day's reminders, and the due reminder once told — and an unknown
-- kind of record is refused. The task-based follow-up doors are gone. Every value is made up; the day is the one after
-- the database is built (see NOTE-06).
-- Sabotage: supabase/tests/sabotage/a-follow-up-forgets-its-record.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:00:00+03', true);
select set_config('t.am', test.person('Test Follow Member', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Follow Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.n', api.note_capture('reminder', jsonb_build_object('title', 'Made-up call them back',
  'remind_at', current_setting('t.d1') || 'T10:00:00+03:00',
  'about', jsonb_build_object('entity', 'partner', 'id', current_setting('t.p')))) ->> 'id', true);

select set_config('t.about', jsonb_build_object('entity', 'partner', 'id', current_setting('t.p'), 'label', 'Made Up Follow Co')::text, true);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'visibility', 'private', 'a follow-up is Only me by default');
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'about', current_setting('t.about')::jsonb,
  'the note says what it is about');
select test.eq(api.my_day('me') -> 'reminders' -> 0 -> 'about', current_setting('t.about')::jsonb,
  'and so does its reminder on My day');

select test.as_owner();
select set_config('v2.test_now', current_setting('t.d1') || ' 10:00:30+03', true);
select notify.send_reminders();
select test.as_person(current_setting('t.am')::uuid);
select test.eq(api.reminders_due() -> 'due' -> 0 -> 'about', current_setting('t.about')::jsonb,
  'and the alert when it is due');

select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made-up', 'about', jsonb_build_object('entity', 'contract', 'id', current_setting('t.p')))),
  'P0001', 'only a client, a task or an invoice', 'note.about_invalid');
select test.ok(to_regprocedure('api.follow_up(text, uuid, date, uuid, text)') is null
               and to_regprocedure('api.follow_ups(text, uuid)') is null, 'the task-based follow-up doors are gone');
