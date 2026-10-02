-- NOTE-03 — Turn into a logged call (V433; TECH-SPEC §3.3a): one request makes the call on the organisation through
-- Log activity, carrying the note's words and its mentions, and the link — the note shows "turned into", the call
-- "from note" — and one Undo reverts both. The call follows its own rule: a colleague who sees the organisation but not
-- the note sees the call without the chip. Removing the call leaves the note and clears the chip; Undo of the removal
-- brings it back. A reminder is made the same way (a task and an action item: NOTE-07); an achievement is not there
-- yet. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-removed-record-keeps-its-chip.sql, a-from-note-chip-shows-a-private-note.sql.
select set_config('t.dep', test.department('commercial')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'test_gamma', 'Test Gamma', 'فريق غاما');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_gamma')
where id in (current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Turned Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

-- a team note, mentioning a teammate, turned into a logged call
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up call notes',
  'body', 'Made-up: they want a proposal', 'visibility', 'team', 'meeting_partner_id', null),
  array[current_setting('t.am2')::uuid]) ->> 'id', true);
select test.raises(format('select api.note_turn_into(%L, %L)', current_setting('t.n'), 'activity'), 'P0001',
  'a call needs its organisation', 'note.turn_into_needs_partner');
select set_config('t.made', api.note_turn_into(current_setting('t.n')::uuid, 'activity',
  jsonb_build_object('partner_id', current_setting('t.p'), 'type', 'call', 'outcome', 'answered'))::text, true);
select set_config('t.a', current_setting('t.made')::jsonb ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from core.note where id = current_setting('t.a')::uuid and kind = 'activity'
                and entity_id = current_setting('t.p')::uuid), 1, 'the call is logged on the organisation');
select test.eq((select body from core.note where id = current_setting('t.a')::uuid),
  E'Made-up call notes\nMade-up: they want a proposal', 'carrying the note''s words');
select test.eq((select array_agg(person_id) from core.mention where note_id = current_setting('t.a')::uuid),
  array[current_setting('t.am2')::uuid], 'and its mentions');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'links' -> 0 ->> 'id', current_setting('t.a'),
  'the note shows what it turned into');
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'links' -> 0 ->> 'type', 'call', 'a call');
select test.eq(api.notes('partner', current_setting('t.p')::uuid) -> 0 -> 'from_note' ->> 'id',
  current_setting('t.n'), 'the call shows the note it came from');
select test.eq(api.from_note('note', current_setting('t.a')::uuid) ->> 'id', current_setting('t.n'),
  'and so does its own door');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (current_setting('t.a')::uuid, (select id from my.note_link
                                                                    where note_id = current_setting('t.n')::uuid))),
  1, 'the call and the link are one request');
select test.eq((select q.label_key from audit.request q
                where q.id = (current_setting('t.made')::jsonb ->> 'request_id')::uuid), 'partner.activity_logged',
  'logged in the words of the call, naming no note');

-- the head sees the organisation and its call, not the team note: no chip
select test.as_person(current_setting('t.head')::uuid);
select test.ok((api.notes('partner', current_setting('t.p')::uuid) -> 0 ->> 'from_note') is null,
  'someone who cannot see the note sees the call without its chip');

-- one Undo takes the whole conversion back — its author's to undo, not the head's
select test.raises(format('select api.undo(%L)', current_setting('t.made')::jsonb ->> 'request_id'), '42501',
  'the head may not undo a conversion they cannot see', 'undo.not_allowed');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.made')::jsonb ->> 'request_id'),
  'the conversion is undone');
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)), 0, 'the call is gone');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 0, 'and so is the link');

select set_config('t.made', api.note_turn_into(current_setting('t.n')::uuid, 'activity',
  jsonb_build_object('partner_id', current_setting('t.p'), 'type', 'call', 'outcome', 'answered'))::text, true);
select set_config('t.a', current_setting('t.made')::jsonb ->> 'id', true);

-- removing the call leaves the note and clears the chip; Undo brings the chip back
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.rm', api.notes_remove(array[current_setting('t.a')::uuid]) ->> 'request_id', true);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'title', 'Made-up call notes', 'the note stays');
select test.eq(jsonb_array_length(api.my_note(current_setting('t.n')::uuid) -> 'links'), 0, 'its chip clears');
select test.runs(format('select api.undo(%L)', current_setting('t.rm')), 'the removal is undone');
select test.eq(api.my_note(current_setting('t.n')::uuid) -> 'links' -> 0 ->> 'id', current_setting('t.a'),
  'and the chip is back');

-- removing the note leaves the call and clears its chip
select set_config('t.rn', api.my_notes_remove(array[current_setting('t.n')::uuid]) ->> 'request_id', true);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)), 1, 'the call stays');
select test.ok((api.notes('partner', current_setting('t.p')::uuid) -> 0 ->> 'from_note') is null, 'without its chip');
select test.runs(format('select api.undo(%L)', current_setting('t.rn')), 'the note''s removal is undone');

-- a reminder, and what is not there yet
select set_config('t.r', api.note_turn_into(current_setting('t.n')::uuid, 'reminder',
  jsonb_build_object('remind_at', core.clock() + interval '1 day')) ->> 'id', true);
select test.ok(api.my_note(current_setting('t.n')::uuid) -> 'links'
                 @> jsonb_build_array(jsonb_build_object('entity', 'reminder', 'id', current_setting('t.r'))),
  'a note turned into a reminder shows it');
select test.eq(api.my_day('me') -> 'reminders' -> 0 ->> 'text', E'Made-up call notes\nMade-up: they want a proposal',
  'which carries its words');
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n'), 'reminder',
  jsonb_build_object('remind_at', core.clock() - interval '1 minute')), 'P0001', 'a reminder is for later',
  'reminder.time_passed');
select test.raises(format('select api.note_turn_into(%L, %L)', current_setting('t.n'), 'achievement'), 'P0001',
  'an achievement with achievements', 'note.turn_into_not_yet');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.note_turn_into(%L, %L)', current_setting('t.n'), 'reminder'), '42501',
  'only its author converts a note', 'note.not_yours');
