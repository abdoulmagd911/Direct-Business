-- SIGN-04 — a person with a .com and a .net e-mail is one person whichever door they use: each door's auth user links
-- to the same person, api.me() names them from either, and the doors used are recorded on the link (V2; the Google
-- and Zoom rules tested through identities made directly, as the admin API would — no real Google or Zoom).
-- Sabotage: supabase/tests/sabotage/doors-are-not-recorded.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into core.person_email (person_id, email, is_primary)
values (current_setting('t.am1')::uuid, 'test.am1@example.com', true),
       (current_setting('t.am1')::uuid, 'test.am1@example.net', false);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c0', 'test.am1@example.com'),
                                          ('00000000-0000-4000-8000-0000000000e0', 'test.am1@example.net');
insert into core.person_auth (auth_user_id, person_id, email) values
  ('00000000-0000-4000-8000-0000000000c0', current_setting('t.am1')::uuid, 'test.am1@example.com'),
  ('00000000-0000-4000-8000-0000000000e0', current_setting('t.am1')::uuid, 'test.am1@example.net');
select test.as_auth('00000000-0000-4000-8000-0000000000c0', '00000000-0000-4000-8000-00000000c001');
select test.eq(api.sign_in_complete(true, 'google'), 'ok', 'the .com e-mail through Google');
select set_config('t.via_com', api.me() -> 'person' ->> 'id', true);
select test.as_auth('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000e001');
select test.eq(api.sign_in_complete(true, 'zoom'), 'ok', 'the .net e-mail through Zoom');
select set_config('t.via_net', api.me() -> 'person' ->> 'id', true);
select test.as_auth('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000e002');
select test.eq(api.sign_in_complete(false, 'email'), 'ok', 'the .net e-mail through a code');
select test.as_owner();
select test.eq(current_setting('t.via_com'), current_setting('t.am1'), 'Google lands on the person');
select test.eq(current_setting('t.via_net'), current_setting('t.am1'), 'Zoom lands on the same person');
select test.eq((select providers from core.person_auth where auth_user_id = '00000000-0000-4000-8000-0000000000e0'),
  array['zoom', 'email'], 'the .net link records both doors it used');
select test.eq((select count(distinct person_id) from core.sign_in_log where person_id = current_setting('t.am1')::uuid
  and result = 'ok')::int, 1, 'three sign-ins, one person');
