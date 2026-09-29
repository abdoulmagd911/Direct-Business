-- SIGN-07 — only Full on Organization & access (an admin, by default) adds or removes allowed e-mails and links a sign-in to them; the link needs the auth user's
-- e-mail to be a live allowed e-mail of that person; a removal returns the auth users the server must ban; each is one
-- logged request (§4 step 2, §8 "Organization & access: Full for admins").
-- Sabotage: supabase/tests/sabotage/anyone-manages-the-allow-list.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.new', test.person('Test Newcomer', 'member')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.person_email_add(%L, %L)', current_setting('t.new'), 'test.new@example.com'),
  '42501', 'a team member cannot allow an e-mail', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.added', api.person_email_add(current_setting('t.new')::uuid, 'Test.New@example.com')::text, true);
select test.as_owner();
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'test.new@example.com'),
                                          ('00000000-0000-4000-8000-0000000000a2', 'test.someone@example.com');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_auth_link(%L, %L)', 'test.new@example.com', '00000000-0000-4000-8000-0000000000a2'),
  'P0001', 'the auth user must be the e-mail''s own', 'person_auth.user_email_mismatch');
select test.raises(format('select api.person_auth_link(%L, %L)', 'test.nobody@example.com', '00000000-0000-4000-8000-0000000000a2'),
  'P0001', 'an e-mail not on the list', 'person_auth.email_not_allowed');
select api.person_auth_link('test.new@example.com', '00000000-0000-4000-8000-0000000000a1');
select set_config('t.removed', api.person_email_remove((current_setting('t.added')::jsonb ->> 'id')::uuid, 'made up for a test')::text, true);
select test.as_owner();
select test.eq((select person_id from core.person_auth where auth_user_id = '00000000-0000-4000-8000-0000000000a1'),
  current_setting('t.new')::uuid, 'the sign-in was linked to the newcomer');
select test.eq(current_setting('t.removed')::jsonb -> 'ban', '["00000000-0000-4000-8000-0000000000a1"]'::jsonb,
  'the removal names the auth user to ban');
select test.eq((select kind from audit.request where id = (current_setting('t.added')::jsonb ->> 'request_id')::uuid),
  'ui', 'the addition was one request');
select test.eq((select actor_id from audit.request where id = (current_setting('t.added')::jsonb ->> 'request_id')::uuid),
  current_setting('t.admin')::uuid, 'by the admin');
