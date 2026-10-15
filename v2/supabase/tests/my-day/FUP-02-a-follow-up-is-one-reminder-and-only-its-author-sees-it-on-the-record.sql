-- FUP-02 — a follow-up is one item, not two, and only its author sees it on the record (the oversight's production walk
-- of 14 Oct, findings 1 and 4; V632 Stage 2, V282, V454): a note captured as a Reminder is listed once on My day, as its
-- reminder with its time and its record, and not again among My notes; a plain note is still listed. The record page's
-- read gives the reader their own open follow-ups on that record — to an admin who may see the record, nothing of
-- anyone else's — and refuses an unknown kind of record. Every value is made up; the day is the one after the database
-- is built (see NOTE-06).
-- Sabotages: supabase/tests/sabotage/a-follow-up-is-listed-twice.sql, a-follow-up-shows-to-others-on-the-record.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:00:00+03', true);
select set_config('t.am', test.person('Test Once Member', 'member')::text, true);
select set_config('t.admin', test.person('Test Once Admin', 'admin')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Once Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.n', api.note_capture('reminder', jsonb_build_object('title', 'Follow-up',
  'remind_at', current_setting('t.d1') || 'T10:00:00+03:00',
  'about', jsonb_build_object('entity', 'partner', 'id', current_setting('t.p')))) ->> 'id', true);
select api.note_capture('sticky', jsonb_build_object('title', 'Made-up plain note'));

select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'notes') x
                where x ->> 'id' = current_setting('t.n')), 0, 'the follow-up is not listed again among My notes');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'reminders') x
                where x ->> 'note_id' = current_setting('t.n')), 1, 'it is listed once, as its reminder');
select test.eq(api.my_day('me') -> 'reminders' -> 0 ->> 'remind_at',
               to_jsonb((current_setting('t.d1') || ' 10:00:00+03')::timestamptz) #>> '{}', 'with its time');
select test.eq(api.my_day('me') -> 'notes' -> 0 ->> 'title', 'Made-up plain note', 'a plain note is still listed');
select test.eq((api.my_day('me') ->> 'notes_total')::int, 1, 'and counted once');

select test.eq(jsonb_array_length(api.my_follow_ups('partner', current_setting('t.p')::uuid)), 1,
  'the record page shows its author their follow-up');
select test.eq(api.my_follow_ups('partner', current_setting('t.p')::uuid) -> 0 ->> 'note_id', current_setting('t.n'),
  'the one they made');
select test.raises(format('select api.my_follow_ups(%L, %L::uuid)', 'contract', current_setting('t.p')),
  'P0001', 'only a client, a task or an invoice', 'note.about_invalid');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.my_follow_ups('partner', current_setting('t.p')::uuid), '[]'::jsonb,
  'an admin who sees the client sees no one else''s follow-up on it (V454)');
