-- NOTE-01 — notes on a record (§3.4, V138): whoever may add to a record writes a comment, a meeting note (with its
-- date) or feedback on its timeline, which anyone who sees the record reads — a viewer adds nothing; each person
-- @mentioned is told once (an owner mentioned is not told twice), and only people who can see the record may be
-- mentioned; only its author edits a note (it shows as edited, and people newly mentioned are told); its author or
-- Full on the page removes it, and Undo brings it back; the latest feedback note is the partner's last feedback date.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-mention-tells-nobody.sql, an-owner-mentioned-is-told-twice.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.am3', test.person('Test Third Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'partners', 'none', 'made up: no partners');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Timeline Co',
  'account_manager_id', current_setting('t.am2'))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.added', api.note_add('partner', current_setting('t.p')::uuid, 'comment', 'Made-up remark for @Second',
  null, array[current_setting('t.am2')::uuid, current_setting('t.am2')::uuid])::text, true);
select set_config('t.n', current_setting('t.added')::jsonb ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = (current_setting('t.added')::jsonb ->> 'request_id')::uuid), 1,
  'the person mentioned — the partner''s owner too — is told once');
select test.eq((select kind from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = (current_setting('t.added')::jsonb ->> 'request_id')::uuid), 'mentioned', 'as a mention');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])', 'partner', current_setting('t.p'),
  'comment', 'Made up', current_setting('t.outsider')), 'P0001', 'nobody is mentioned where they cannot look',
  'note.mention_cannot_see');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'meeting', 'Made up'),
  'P0001', 'a meeting note needs its date', 'note.date_required');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'call', 'Made up'),
  'P0001', 'a call goes through Log call', 'note.kind_invalid');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'comment', '   '),
  'P0001', 'a note has words', 'note.body_required');
select api.note_add('partner', current_setting('t.p')::uuid, 'feedback', 'Made-up feedback: happy with the rates',
  current_date - 3);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'last_feedback_on', (current_date - 3)::text,
  'the latest feedback is the partner''s last feedback date');

select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)), 2, 'a viewer reads the timeline');
select test.eq(api.notes('partner', current_setting('t.p')::uuid, array['feedback']) -> 0 ->> 'kind', 'feedback',
  'filtered by kind');
select test.raises(format('select api.note_add(%L, %L, %L, %L)', 'partner', current_setting('t.p'), 'comment', 'Made up'),
  '42501', 'but adds no note', 'access.needs_level');

select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.note_edit(%L, %L, 1)', current_setting('t.n'), 'Made up'), '42501',
  'only its author edits a note', 'note.not_yours');
select test.as_person(current_setting('t.am1')::uuid);
select api.note_edit(current_setting('t.n')::uuid, 'Made-up remark, reworded', 1,
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
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)), 1, 'Full on the page removes it');
select api.undo(current_setting('t.r')::uuid);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid, array['comment'])), 1,
  'and Undo brings it back');
