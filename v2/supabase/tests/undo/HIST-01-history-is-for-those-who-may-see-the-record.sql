-- HIST-01 — history is for those who may see the record (§3.3): a record's changes, newest first, for View on its page
-- or an admin (a department's for admins only — Settings, V97); a profile's for its owner (and an admin); the whole log (Settings → Activity) for Activity · View —
-- admins and managers — filtered by who and by record type.
-- Sabotage: supabase/tests/sabotage/history-is-open-to-all.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);
select set_config('t.dep', test.department('hist_one')::text, true);

select set_config('t.r1', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'History Renamed' where id = current_setting('t.dep')::uuid;
select test.done();
select set_config('t.r2', test.act(current_setting('t.head')::uuid)::text, true);
update core.department set name_ar = 'اسم للتاريخ' where id = current_setting('t.dep')::uuid;
select test.done();
select set_config('t.r3', test.act(current_setting('t.am1')::uuid)::text, true);
insert into core.person_profile (person_id, theme) values (current_setting('t.am1')::uuid, 'dark');
select test.done();
select set_config('t.prof', (select id::text from core.person_profile where person_id = current_setting('t.am1')::uuid),
  true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.h', api.record_history('department', current_setting('t.dep')::uuid)::text, true);
select test.eq(jsonb_array_length(current_setting('t.h')::jsonb), 3, 'the department''s changes: made, renamed, renamed');
select test.eq(current_setting('t.h')::jsonb -> 0 ->> 'request_id', current_setting('t.r2'), 'newest first');
select test.eq(current_setting('t.h')::jsonb -> 0 ->> 'actor_id', current_setting('t.head'), 'with who');
select test.eq(current_setting('t.h')::jsonb -> 1 -> 'after' ->> 'name_en', 'History Renamed', 'and what changed');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.record_history(%L, %L)', 'department', current_setting('t.dep')), '42501',
  'a member without View on Organization & access does not see a department''s history', 'access.needs_level');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.record_history(%L, %L)', 'department', current_setting('t.dep')), '42501',
  'nor does a head', 'access.needs_level');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(jsonb_array_length(api.record_history('profile', current_setting('t.prof')::uuid)), 1,
  'a person sees their own profile''s history');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.record_history(%L, %L)', 'profile', current_setting('t.prof')), '42501',
  'but not someone else''s', 'access.needs_level');
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.record_history(%L, %L)', 'profile', current_setting('t.prof')), '42501',
  'not even a head''s', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(jsonb_array_length(api.record_history('profile', current_setting('t.prof')::uuid)), 1,
  'an admin sees it');
select test.raises(format('select api.record_history(%L, %L)', 'made_up', current_setting('t.prof')), 'P0002',
  'an unknown record type', 'history.unknown_entity');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises('select api.activity()', '42501', 'a member does not see the whole log', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(exists (select 1 from jsonb_array_elements(api.activity(p_actor => current_setting('t.admin')::uuid)) r
                       where r ->> 'request_id' = current_setting('t.r1')),
  'the log, by who');
select test.as_person(current_setting('t.head')::uuid);
select test.ok(not exists (select 1 from jsonb_array_elements(api.activity(p_actor => current_setting('t.admin')::uuid)) r
                           where r ->> 'request_id' = current_setting('t.r1')),
  'a head sees no change to a record they may not see (a department — V97)');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(not exists (select 1 from jsonb_array_elements(api.activity(p_actor => current_setting('t.admin')::uuid)) r
                           where r ->> 'request_id' in (current_setting('t.r2'), current_setting('t.r3'))),
  'and only that person''s requests');
select test.eq((select count(*)::int from jsonb_array_elements(api.activity(p_entity => 'profile')) r
                where r ->> 'request_id' in (current_setting('t.r1'), current_setting('t.r2'), current_setting('t.r3'))),
  1, 'by record type');
select test.raises('select api.activity(p_entity => ''made_up'')', 'P0002', 'an unknown record type',
  'history.unknown_entity');
