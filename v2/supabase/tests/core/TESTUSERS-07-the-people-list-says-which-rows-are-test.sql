-- TESTUSERS-07 (V656) — The People list says which rows are TEST users, from the data's own mark (core.person.is_test),
-- so the screen offers "Sign in as test user" on those rows only. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-people-list-hides-the-test-mark.sql.
select test.department('commercial');
select test.as_owner();
select core.test_users_seed();
select set_config('t.admin', test.person('Made-up Admin', 'admin')::text, true);
select set_config('t.real', test.person('Made-up Colleague', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.people', api.people()::text, true);
select test.eq((select count(*)::int from jsonb_array_elements(current_setting('t.people')::jsonb) p where (p ->> 'is_test')::boolean), 6,
  'six rows say they are TEST users');
select test.eq((select count(*)::int from jsonb_array_elements(current_setting('t.people')::jsonb) p
                where (p ->> 'is_test')::boolean and p ->> 'full_name_en' not like 'TEST %'), 0, 'and every one of them is named TEST');
select test.eq((select (p ->> 'is_test')::boolean from jsonb_array_elements(current_setting('t.people')::jsonb) p
                where p ->> 'id' = current_setting('t.real')), false, 'a real colleague is not marked');
