-- NOTE-02 — a My day note is seen by its own rule (V454, V143, V183; TECH-SPEC §3.3a). Private — the default — by its
-- author alone, admins included: in nobody else's My day, note door, search, history, Activity page or Follow, and it
-- mentions nobody. Team: the author's team (home, helping or leading) and admins, never another team. Workspace:
-- everyone. A mention must see the note and is told once; sharing more narrowly while someone mentioned would lose the
-- note is refused. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-admin-reads-a-private-note.sql, a-private-note-found-in-search.sql,
-- a-team-note-seen-by-another-team.sql, the-admin-shortcut-ignores-rule-only.sql, a-rule-only-type-without-its-rule.sql.
select set_config('t.dep', test.department('commercial')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'test_alpha', 'Test Alpha', 'فريق ألفا'),
       (current_setting('t.dep')::uuid, 'test_beta', 'Test Beta', 'فريق بيتا');
select set_config('t.author', test.person('Test Author', 'member')::text, true);
select set_config('t.mate', test.person('Test Teammate', 'member')::text, true);
select set_config('t.helper', test.person('Test Helper', 'member')::text, true);
select set_config('t.other', test.person('Test Other Team', 'member')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_alpha')
where id in (current_setting('t.author')::uuid, current_setting('t.mate')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_beta')
where id in (current_setting('t.helper')::uuid, current_setting('t.other')::uuid);
insert into core.person_team_assist (person_id, team_id)
values (current_setting('t.helper')::uuid, (select id from core.team where code = 'test_alpha'));

-- ---------------------------------------------------------------- private: the author's alone
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up quiet thought',
  'body', 'Made-up words for me alone')) ->> 'id', true);
select test.eq(api.note(current_setting('t.n')::uuid) ->> 'visibility', 'private', 'a note is private by default');
select test.eq(api.my_day('me') -> 'notes' -> 0 ->> 'id', current_setting('t.n'), 'it is on its author''s My day');
select test.eq(jsonb_array_length(api.search('quiet thought') -> 'notes'), 1, 'its author finds it');
select test.eq(jsonb_array_length(api.record_history('my_note', current_setting('t.n')::uuid)), 1,
  'its author reads its history');
select test.raises(format('select api.note_capture(%L, %L::jsonb, array[%L]::uuid[])', 'sticky', '{"title": "Made up"}',
  current_setting('t.mate')), 'P0001', 'a private note mentions nobody', 'note.private_mentions_nobody');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.note(%L)', current_setting('t.n')), 'P0002',
  'an admin cannot open a member''s private note', 'common.not_found');
select test.eq(jsonb_array_length(api.search('quiet thought') -> 'notes'), 0, 'nor find it');
select test.raises(format('select api.record_history(%L, %L)', 'my_note', current_setting('t.n')), '42501',
  'nor read its history', 'access.needs_level');
select test.eq(jsonb_array_length(api.activity(null, 'my_note')), 0, 'nor see it on the Activity page');
select test.raises(format('select api.follow(%L, %L, true)', 'my_note', current_setting('t.n')), '42501', 'nor follow it',
  'access.needs_level');
select test.eq(jsonb_array_length(api.my_day('team') -> 'notes') + jsonb_array_length(api.my_day('workspace') -> 'notes'),
  0, 'nor meet it on My day');

select test.as_person(current_setting('t.mate')::uuid);
select test.raises(format('select api.note(%L)', current_setting('t.n')), 'P0002', 'a teammate cannot open it either',
  'common.not_found');
select test.eq(jsonb_array_length(api.my_day('team') -> 'notes'), 0, 'nor meet it on My team');
select test.raises(format('select api.note_update(%L, %L::jsonb, 1)', current_setting('t.n'), '{"title": "Made up"}'),
  'P0002', 'nor change it', 'common.not_found');

-- ---------------------------------------------------------------- team: the author's team and admins
select test.as_person(current_setting('t.author')::uuid);
select test.raises(format('select api.note_capture(%L, %L::jsonb, array[%L]::uuid[])', 'sticky',
  '{"title": "Made up", "visibility": "team"}', current_setting('t.other')), 'P0001',
  'a team note mentions nobody outside the team', 'note.mention_cannot_see');
select set_config('t.team', api.note_capture('checklist', jsonb_build_object('title', 'Made-up team list',
  'visibility', 'team', 'items', jsonb_build_array(jsonb_build_object('text', 'Made-up first row'))),
  array[current_setting('t.mate')::uuid, current_setting('t.mate')::uuid])::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.mate')::uuid and kind = 'note_mention'
                  and request_id = (current_setting('t.team')::jsonb ->> 'request_id')::uuid), 1,
  'the teammate mentioned is told once');
select set_config('t.tn', current_setting('t.team')::jsonb ->> 'id', true);
select test.eq(authz.can_see_as(current_setting('t.mate')::uuid, 'my.note', current_setting('t.tn')::uuid), true,
  'a teammate sees a team note');
select test.eq(authz.can_see_as(current_setting('t.helper')::uuid, 'my.note', current_setting('t.tn')::uuid), true,
  'so does someone who helps the team');
select test.eq(authz.can_see_as(current_setting('t.admin')::uuid, 'my.note', current_setting('t.tn')::uuid), true,
  'and an admin');
select test.eq(authz.can_see_as(current_setting('t.other')::uuid, 'my.note', current_setting('t.tn')::uuid), false,
  'another team does not');
select test.eq(authz.can_see_as(current_setting('t.admin')::uuid, 'my.note', current_setting('t.n')::uuid), false,
  'while the private one stays the author''s alone');

select test.as_person(current_setting('t.mate')::uuid);
select test.eq(api.my_day('team') -> 'notes' -> 0 ->> 'id', current_setting('t.tn'), 'it is on the teammate''s My team');
select test.eq(api.my_day('team') -> 'notes' -> 0 -> 'items' -> 0 ->> 'text', 'Made-up first row', 'with its rows');
select test.eq(jsonb_array_length(api.search('team list') -> 'notes'), 1, 'and found in search');
select test.as_person(current_setting('t.other')::uuid);
select test.eq(jsonb_array_length(api.my_day('team') -> 'notes') + jsonb_array_length(api.search('team list') -> 'notes'),
  0, 'another team neither meets nor finds it');

select test.as_person(current_setting('t.author')::uuid);
select test.raises(format('select api.note_update(%L, %L::jsonb, 1)', current_setting('t.tn'), '{"visibility": "private"}'),
  'P0001', 'made private while someone is mentioned: refused', 'note.mention_cannot_see');
select test.runs(format('select api.note_update(%L, %L::jsonb, 1, %L::uuid[])', current_setting('t.tn'),
  '{"visibility": "private"}', '{}'), 'made private with its mentions dropped');
select test.as_owner();
select test.eq(authz.can_see_as(current_setting('t.mate')::uuid, 'my.note', current_setting('t.tn')::uuid), false,
  'and then the teammate no longer sees it');

-- ---------------------------------------------------------------- workspace: everyone
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.wn', api.note_capture('sticky', jsonb_build_object('title', 'Made-up shared idea',
  'visibility', 'workspace')) ->> 'id', true);
select test.as_person(current_setting('t.other')::uuid);
select test.eq(api.my_day('workspace') -> 'notes' -> 0 ->> 'id', current_setting('t.wn'), 'a workspace note is everyone''s');
select test.eq((api.my_day('workspace') -> 'notes' -> 0 ->> 'mine')::boolean, false, 'not theirs to change');
select test.eq(jsonb_array_length(api.my_day('me') -> 'notes'), 0, 'and not on their own list');

-- ---------------------------------------------------------------- a rule-only record type names its rule (V183)
select test.as_owner();
select test.raises($$update core.entity set visible = null where key = 'my_note'$$, '23514',
  'a record type whose own rule alone decides must name that rule');
