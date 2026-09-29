-- NOTE-01 — notes on a record (§3.4, V150): whoever may add to a record writes a comment, an update or a meeting note
-- on its timeline, on the day it happened — never a later one (V400) — which anyone who sees the record reads; a viewer
-- adds nothing; each person @mentioned is told once (an owner mentioned is not told twice), only people who can see the
-- record may be mentioned, and a note dated in the past tells nobody; only its author edits a note (it shows as edited,
-- and people newly mentioned are told); its author or Full on the record removes it, and Undo brings it back. Every
-- value is made up.
-- Sabotage: supabase/tests/sabotage/a-mention-tells-nobody.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.am3', test.person('Test Third Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.outsider')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Timeline Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am2'))))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.added', api.note_add('partner', current_setting('t.p')::uuid, 'comment', 'Made-up remark for @Second',
  null, array[current_setting('t.am2')::uuid, current_setting('t.am2')::uuid])::text, true);
select set_config('t.n', current_setting('t.added')::jsonb ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = (current_setting('t.added')::jsonb ->> 'request_id')::uuid), 1,
  'the person mentioned — the organisation''s owner too — is told once');
select test.eq((select kind from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = (current_setting('t.added')::jsonb ->> 'request_id')::uuid), 'mentioned', 'as a mention');
select test.eq((select happened_on from core.note where id = current_setting('t.n')::uuid), core.riyadh_today(),
  'a note happened today unless it says otherwise');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])', 'partner', current_setting('t.p'),
  'comment', 'Made up', current_setting('t.outsider')), 'P0001', 'nobody is mentioned where they cannot look',
  'note.mention_cannot_see');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'activity', 'Made up'),
  'P0001', 'an activity goes through Log activity', 'note.kind_invalid');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'comment', '   '),
  'P0001', 'a note has words', 'note.body_required');
select test.raises(format('select api.note_add(%L, %L, %L, %L, %L)', 'partner', current_setting('t.p'), 'meeting_note',
  'Made up', core.riyadh_today() + 1), 'P0001', 'nothing happens after the day it is logged', 'common.date_in_future');
select set_config('t.past', api.note_add('partner', current_setting('t.p')::uuid, 'meeting_note',
  'Made-up meeting note from last week', core.riyadh_today() - 7, array[current_setting('t.am3')::uuid])::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.past')::jsonb ->> 'request_id')::uuid), 0,
  'a note dated in the past tells nobody — the person it mentions, the owner (V400)');
select test.eq((select happened_on from core.note where id = (current_setting('t.past')::jsonb ->> 'id')::uuid),
  core.riyadh_today() - 7, 'and keeps the day it happened');

select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)), 2, 'a viewer reads the timeline');
select test.eq(api.notes('partner', current_setting('t.p')::uuid) -> 1 ->> 'kind', 'meeting_note',
  'newest day first');
select test.eq(api.notes('partner', current_setting('t.p')::uuid, array['meeting_note']) -> 0 ->> 'kind', 'meeting_note',
  'filtered by kind');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'comment', 'Made up'),
  '42501', 'but adds no note', 'access.needs_level');
select test.as_person(current_setting('t.outsider')::uuid);
select test.raises(format('select api.notes(%L, %L)', 'partner', current_setting('t.p')), '42501',
  'a person who sees neither side reads no timeline', 'access.needs_level');

select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.note_edit(%L, %L, 1)', current_setting('t.n'), '{"body": "Made up"}'), '42501',
  'only its author edits a note', 'note.not_yours');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.note_edit(%L, %L, 1)', current_setting('t.n'), '{"outcome": "answered"}'), 'P0001',
  'a comment has no outcome', 'note.unknown_field');
select api.note_edit(current_setting('t.n')::uuid, '{"body": "Made-up remark, reworded"}', 1,
  array[current_setting('t.am2')::uuid, current_setting('t.am3')::uuid]);
select test.ok((select n ->> 'edited_at' from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n ->> 'id' = current_setting('t.n')) is not null, 'it shows as edited');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am3')::uuid
                and kind = 'mentioned'), 1, 'a person newly mentioned is told');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'mentioned'), 1, 'one mentioned before is not told again');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.notes_remove(array[%L]::uuid[])', current_setting('t.n')), '42501',
  'a viewer removes no note', 'note.not_yours');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.notes_remove(array[current_setting('t.n')::uuid], 'made up: off topic') ->> 'request_id', true);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)), 1, 'Full on the record removes it');
select api.undo(current_setting('t.r')::uuid);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid, array['comment'])), 1,
  'and Undo brings it back');
