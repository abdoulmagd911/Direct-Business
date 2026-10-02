-- ACH-10 — Turn into an achievement (V433, P5-4): a note on My day becomes an achievement through the achievement's own
-- door — its title and words from the note, dated by the note's day, its number — in one request that reads as the
-- achievement logged, linked both ways: the note shows "turned into", the achievement "from note"; the note's mentions
-- are its participants. One Undo reverts the achievement and the link. The achievement's own rules still hold: a
-- category it does not know is refused and nothing is made. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-note-turned-into-an-achievement-keeps-no-link.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select set_config('t.mem2', test.person('Test Second Member', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);

select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up travel award won',
  'body', 'Made-up: the judges named us best agency', 'visibility', 'workspace'),
  array[current_setting('t.mem2')::uuid]) ->> 'id', true);
select test.raises(format('select api.note_turn_into(%L, %L, %L::jsonb)', current_setting('t.n'), 'achievement',
  '{"category": "NO_SUCH_CATEGORY"}'), 'P0002', 'a category it does not know is refused', 'list.unknown_value');
select set_config('t.r', api.note_turn_into(current_setting('t.n')::uuid, 'achievement',
  '{"category": "AWARD"}'::jsonb)::text, true);

select test.as_owner();
select test.eq((select count(*)::int from my.note_link where note_id = current_setting('t.n')::uuid), 1,
  'the refused try made nothing; the conversion made one link');
select test.eq((select a.title || ' · ' || a.notes || ' · ' || a.happened_on::text from perf.achievement a
                where a.id = (current_setting('t.r')::jsonb ->> 'id')::uuid),
               'Made-up travel award won · Made-up: the judges named us best agency · 2026-10-01',
               'its title and words from the note, dated by the note''s day');
select test.eq((select a.owner_id from perf.achievement a where a.id = (current_setting('t.r')::jsonb ->> 'id')::uuid),
               current_setting('t.mem')::uuid, 'the author''s own achievement');
select test.eq((current_setting('t.r')::jsonb ->> 'number') like 'ACH-2026-%', true, 'with its number');
select test.eq((select count(*)::int from perf.achievement_participant p
                where p.achievement_id = (current_setting('t.r')::jsonb ->> 'id')::uuid
                  and p.person_id = current_setting('t.mem2')::uuid and p.deleted_at is null), 1,
               'the note''s mention is a participant');
select test.eq((select r.label_key from audit.request r
                where r.id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid),
               'achievement.logged', 'the request reads as the achievement logged, never the note');

-- linked both ways
select test.as_person(current_setting('t.mem')::uuid);
select test.eq((select x ->> 'entity'
                from jsonb_array_elements(api.my_note(current_setting('t.n')::uuid) -> 'links') x),
               'achievement', 'the note shows "turned into"');
select test.eq(api.from_note('achievement', (current_setting('t.r')::jsonb ->> 'id')::uuid) ->> 'id',
               current_setting('t.n'), 'the achievement shows "from note"');

-- one Undo reverts the achievement and the link
select test.runs(format('select api.undo(%L)', current_setting('t.r')::jsonb ->> 'request_id'), 'the author undoes it');
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement a
                where a.id = (current_setting('t.r')::jsonb ->> 'id')::uuid and a.deleted_at is null), 0,
               'the achievement is gone');
select test.eq((select count(*)::int from my.note_link l
                where l.note_id = current_setting('t.n')::uuid and l.deleted_at is null), 0, 'and so is the link');
select test.eq((select count(*)::int from my.note n where n.id = current_setting('t.n')::uuid and n.deleted_at is null), 1,
               'the note stays');
