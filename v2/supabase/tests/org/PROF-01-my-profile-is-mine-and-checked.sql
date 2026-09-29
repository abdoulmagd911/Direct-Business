-- PROF-01 — My profile (§3.1, V9, V131): each person changes their own profile and names — nobody else's, there is no
-- door to another's; a field it does not know is refused; Arabic waits for its switch (V122); the start page must be a
-- page they can open; notification choices name real kinds; a badge must be a valid one; a change from a stale screen
-- to a field someone else changed is refused; each change is one logged request.
-- Sabotage: supabase/tests/sabotage/arabic-before-it-is-approved.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.r', api.profile_update('{"display_name_en": "Made Up", "theme": "direct", "density": "compact",
  "badge_kind": "zodiac", "badge_value": "leo", "nickname_en": "Test Nick", "start_page": "tasks"}', null, 1)::text,
  true);
select test.as_owner();
select test.eq((select display_name_en from core.person_profile where person_id = current_setting('t.am1')::uuid),
  'Made Up', 'a person changes their own profile; the first save makes it');
select test.eq((select nickname_en from core.person where id = current_setting('t.am1')::uuid), 'Test Nick',
  'and their own nickname');
select test.eq((select count(*)::int from core.person_profile where person_id = current_setting('t.am2')::uuid), 0,
  'nobody else''s profile is touched');
select test.eq((select actor_id from audit.request where id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid),
  current_setting('t.am1')::uuid, 'one logged request, theirs');

select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.me() -> 'profile' ->> 'density'), 'compact', 'api.me() shows it at once');
select test.raises($$select api.profile_update('{"person_id": "00000000-0000-4000-8000-000000000001"}')$$, 'P0001',
  'a field My profile does not know is refused', 'profile.unknown_field');
select test.raises($$select api.profile_update('{"locale": "ar"}', 1)$$, 'P0001',
  'Arabic waits until it is switched on', 'profile.arabic_not_enabled');
select test.raises($$select api.profile_update('{"start_page": "activity"}', 1)$$, '42501',
  'the start page must be one they can open', 'access.needs_level');
select test.raises($$select api.profile_update('{"notify": {"made_up_kind": false}}', 1)$$, 'P0001',
  'notification choices name real kinds', 'profile.invalid');
select test.raises($$select api.profile_update('{"notify": {"mentioned": {"in_app": "no"}}}', 1)$$, 'P0001',
  'each choice is on or off', 'profile.invalid');
select test.raises($$select api.profile_update('{"badge_kind": "zodiac", "badge_value": "dragon"}', 1)$$, '23514',
  'a badge must be a real one', 'profile.invalid');
select test.raises($$select api.profile_update('{"full_name_en": " "}', 1, 1)$$, 'P0001',
  'a full name cannot be blank', 'person.full_name_required');
select test.eq((api.profile_update('{"notify": {"mentioned": {"in_app": false}}, "theme": "dark"}', 1)
  ->> 'version')::int, 2, 'the next change names the version it read');
select test.raises($$select api.profile_update('{"theme": "light"}', 1)$$, '40001',
  'a change from a stale screen to a field changed since is refused', 'common.conflict');
select test.eq((api.me() -> 'person' ->> 'version')::int > 1, true, 'api.me() gives the person''s version too');

select test.as_owner();
update core.setting set deleted_at = now(), deleted_by = current_setting('t.am1')::uuid, delete_reason = 'test'
where key = 'app.arabic_enabled' and deleted_at is null;
insert into core.setting (key, department_id, value, valid_from, reason)
values ('app.arabic_enabled', null, 'true', core.riyadh_today(), 'made up for a test');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.profile_update('{"locale": "ar"}', 2) ->> 'version')::int, 3,
  'once Arabic is switched on, a person picks it');
