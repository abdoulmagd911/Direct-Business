-- SIGN-04 — a person with a .com and a .net e-mail is one person: a code sent to either signs in to the same person,
-- api.me() names them from either, and each link records the door it used. The emailed code is the only door (V59):
-- any other is refused until its keys exist and a migration opens it (V23).
-- Sabotages: supabase/tests/sabotage/doors-are-not-recorded.sql, supabase/tests/sabotage/unbuilt-doors-open.sql.
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
select test.eq(api.sign_in_complete(), 'ok', 'a code to the .com e-mail');
select set_config('t.via_com', api.me() -> 'person' ->> 'id', true);
select test.as_auth('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000e001');
select test.eq(api.sign_in_complete('email'), 'ok', 'a code to the .net e-mail');
select set_config('t.via_net', api.me() -> 'person' ->> 'id', true);
select test.raises($$ select api.sign_in_complete('google') $$, 'P0001', 'a door that is not built is refused',
                   'sign_in.unknown_provider');
select test.raises($$ select api.sign_in_complete('zoom') $$, 'P0001', 'nor this one', 'sign_in.unknown_provider');
select test.as_owner();
select test.eq(current_setting('t.via_com'), current_setting('t.am1'), 'the .com e-mail lands on the person');
select test.eq(current_setting('t.via_net'), current_setting('t.am1'), 'the .net e-mail lands on the same person');
select test.eq((select providers from core.person_auth where auth_user_id = '00000000-0000-4000-8000-0000000000e0'),
  array['email'], 'each link records the door it used');
select test.eq((select count(*) from core.sign_in_log where person_id = current_setting('t.am1')::uuid
  and result = 'ok')::int, 2, 'two sign-ins, one person');
select test.eq((select count(*) from core.sign_in_log where provider <> 'email')::int, 0, 'only the code door is logged');
