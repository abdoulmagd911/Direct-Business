-- DEL-05 — Landing 52 (the F1 live re-test of 25 Nov, FIX-11): a Team member opened Recently deleted and read what
-- the admin, the head and the manager had removed. Now what other people removed is listed only to those who may
-- open Activity (Activity · View or above: the admin, a head, a manager as seeded, or whoever is given the page);
-- everyone else — a member, a viewer — is listed only what they removed themselves, even a record that was their
-- own or that they could read while it was live. Every value is made up.
-- Sabotage: supabase/tests/sabotage/recently-deleted-lists-others-removals-to-a-member.sql.
select set_config('v2.test_now', '2026-11-25 09:00:00+03', true);
select set_config('t.one', test.person('Test Bin Member One', 'member')::text, true);
select set_config('t.two', test.person('Test Bin Member Two', 'member')::text, true);
select set_config('t.viewer', test.person('Test Bin Viewer', 'viewer')::text, true);
select set_config('t.manager', test.person('Test Bin Manager', 'manager')::text, true);
select set_config('t.admin', test.person('Test Bin Admin', 'admin')::text, true);
select test.as_owner();
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_bin', 'Test Bin Team', 'فريق السلة');
update core.person set team_id = (select id from core.team where code = 'test_bin')
where id in (current_setting('t.one')::uuid, current_setting('t.two')::uuid, current_setting('t.viewer')::uuid,
             current_setting('t.manager')::uuid);

-- three removals: member one removes their own task; the admin removes another task of member one's; member two
-- removes their own
select test.as_person(current_setting('t.one')::uuid);
select set_config('t.mine', api.task_create(jsonb_build_object('title', 'Made-up bin task one removed')) ->> 'id', true);
select set_config('t.theirs', api.task_create(jsonb_build_object('title', 'Made-up bin task the admin removed')) ->> 'id', true);
select api.tasks_remove(array[current_setting('t.mine')::uuid], 'made up: mine, gone');
select test.as_person(current_setting('t.two')::uuid);
select test.runs(format('select api.task(%L)', current_setting('t.theirs')), 'member two can open member one''s live task');
select set_config('t.other', api.task_create(jsonb_build_object('title', 'Made-up bin task two removed')) ->> 'id', true);
select api.tasks_remove(array[current_setting('t.other')::uuid], 'made up: the other, gone');
select test.as_person(current_setting('t.admin')::uuid);
select api.tasks_remove(array[current_setting('t.theirs')::uuid], 'made up: removed by the admin');

create function pg_temp.listed() returns text language sql as $$
  select coalesce(string_agg(x ->> 'label', ' | ' order by x ->> 'label'), 'nothing')
  from jsonb_array_elements(api.recently_deleted(200)) x
  where x ->> 'id' in (current_setting('t.mine'), current_setting('t.theirs'), current_setting('t.other'))
$$;

-- a member: only what they removed themselves
select test.as_person(current_setting('t.one')::uuid);
select test.eq(pg_temp.listed(), 'Made-up bin task one removed',
  'a member is listed only what they removed themselves — not their own task the admin removed, nor a colleague''s removal');
select test.eq((select (x ->> 'can_restore')::boolean from jsonb_array_elements(api.recently_deleted()) x
                where x ->> 'id' = current_setting('t.mine')), true, 'with Restore on their own removal');
select test.eq((select count(*)::int from jsonb_array_elements(api.recently_deleted(200)) x
                where x ->> 'deleted_by' <> current_setting('t.one')), 0,
  'no row of a member''s Recently deleted was removed by someone else');
select test.as_person(current_setting('t.two')::uuid);
select test.eq(pg_temp.listed(), 'Made-up bin task two removed', 'the other member likewise: their own removal only');

-- a viewer who removed nothing is listed nothing of these
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(pg_temp.listed(), 'nothing', 'a viewer is listed nothing that other people removed');
select test.eq((select count(*)::int from jsonb_array_elements(api.recently_deleted(200)) x
                where x ->> 'deleted_by' <> current_setting('t.viewer')), 0,
  'no row of a viewer''s Recently deleted was removed by someone else');

-- those who may open Activity are listed what other people removed, as before
select test.as_person(current_setting('t.manager')::uuid);
select test.eq(pg_temp.listed(),
  'Made-up bin task one removed | Made-up bin task the admin removed | Made-up bin task two removed',
  'a manager, who may open Activity, is listed what the team removed');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(pg_temp.listed(),
  'Made-up bin task one removed | Made-up bin task the admin removed | Made-up bin task two removed',
  'and the admin');

-- the rule is the page level, not the role's name: a member given Activity · View is listed them too
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.two')::uuid, 'activity', 'view', 'made up: may open Activity');
select test.as_person(current_setting('t.two')::uuid);
select test.eq(pg_temp.listed(),
  'Made-up bin task one removed | Made-up bin task the admin removed | Made-up bin task two removed',
  'a member given Activity · View is listed what other people removed');
