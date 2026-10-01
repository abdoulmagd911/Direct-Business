-- LOCK-01 — too many tries (V172; the 17:22 audit): Supabase's own limits see the app server's address, not the
-- person's, so the database counts per e-mail. Five wrong passwords within fifteen minutes lock the e-mail for fifteen
-- minutes from the fifth — the right password included, and a session made straight through Supabase too; the lock's
-- refusals are logged and are not tries. A successful sign-in, or a password an admin sets, starts the count again. No
-- e-mail is checked more than twenty times in fifteen minutes (codes asked for included). Only the server may ask.
-- Made up.
-- Sabotages: supabase/tests/sabotage/a-locked-email-signs-in.sql,
--            supabase/tests/sabotage/a-wrong-password-is-a-failure-to-send.sql,
--            supabase/tests/sabotage/a-locked-email-completes-through-supabase.sql,
--            supabase/tests/sabotage/a-reset-keeps-the-lock.sql,
--            supabase/tests/sabotage/a-sign-in-never-clears-the-count.sql,
--            supabase/tests/sabotage/an-email-tried-without-end.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.mail', (select email from core.person_auth where auth_user_id = current_setting('t.uid')::uuid), true);

-- the browser cannot ask
set local role authenticated;
select test.raises(format('select api.sign_in_limited(%L)', current_setting('t.mail')), '42501',
  'whether an e-mail is locked is the server''s question');
reset role;

-- five wrong passwords within fifteen minutes lock the e-mail
set local role service_role;
select api.sign_in_password_refused(current_setting('t.mail'), 'invalid_credentials', 'test-agent')
from generate_series(1, 4);
select test.eq(api.sign_in_password_check(current_setting('t.mail')), 'allowed', 'four wrong passwords lock nothing');
select test.eq(api.sign_in_password_refused(current_setting('t.mail'), 'invalid_credentials', 'test-agent'), 'locked',
  'the fifth within fifteen minutes locks the e-mail, and the server is told at once');
select test.eq(api.sign_in_password_check(current_setting('t.mail'), 'test-agent'), 'locked',
  'then even the right password is not tried');
select test.eq(api.sign_in_limited(upper(current_setting('t.mail'))), 'locked', 'whatever its capitals');
reset role;
select test.eq((select string_agg(result || ' ×' || n, ', ' order by result)
                from (select result, count(*) as n from core.sign_in_log where email = current_setting('t.mail')
                      group by result) x),
  'locked ×1, wrong_password ×5', 'each wrong password is logged as one, and so is the refusal');

-- a session made straight through Supabase, past the server's check, is no sign-in while locked
select set_config('t.sid', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.uid'), 'role', 'authenticated',
  'session_id', current_setting('t.sid'), 'amr', json_build_array(json_build_object('method', 'password')))::text, true);
set local role authenticated;
select test.eq(api.sign_in_complete('email', 'Test browser', 'test-agent'), 'locked',
  'a session made while the e-mail is locked is refused');
select test.ok(authz.me() is null, 'it reaches nothing');
reset role;
select set_config('request.jwt.claims', '', true);
select test.ok(not exists (select 1 from core.device_session where auth_session_id = current_setting('t.sid')::uuid),
  'and registers no device');

-- nor does the emailed code open it
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('auth.code_door_enabled', null, 'true', null, 'made up: the code door for a test');
select test.as_owner();
set local role service_role;
select test.eq(api.sign_in_check(current_setting('t.mail')), 'locked', 'no code is sent to a locked e-mail');

-- fifteen minutes after the fifth, it may try again
select set_config('v2.test_now', (now() + interval '16 minutes')::text, true);
select test.eq(api.sign_in_password_check(current_setting('t.mail')), 'allowed',
  'fifteen minutes after the fifth wrong password, the e-mail may try again');
select set_config('v2.test_now', '', true);
select test.eq(api.sign_in_password_check(current_setting('t.mail')), 'locked', 'not before');
reset role;

-- "or ask your admin": a password an admin sets starts the count again
select test.as_person(current_setting('t.admin')::uuid);
select api.person_password_set(current_setting('t.am1')::uuid, 'made up: locked out', true);
select test.as_owner();
set local role service_role;
select test.eq(api.sign_in_password_check(current_setting('t.mail')), 'allowed',
  'a password an admin sets starts the count again');
reset role;

-- a successful sign-in starts it again too
select set_config('t.am2', test.person('Test Account Manager Two', 'member')::text, true);
select set_config('t.uid2', test.sign_in(current_setting('t.am2')::uuid)::text, true);
select set_config('t.mail2', (select email from core.person_auth where auth_user_id = current_setting('t.uid2')::uuid),
  true);
set local role service_role;
select api.sign_in_password_refused(current_setting('t.mail2'), 'invalid_credentials', 'test-agent')
from generate_series(1, 4);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.uid2'), 'role', 'authenticated',
  'session_id', gen_random_uuid(), 'amr', json_build_array(json_build_object('method', 'password')))::text, true);
set local role authenticated;
select test.eq(api.sign_in_complete('email', 'Test browser', 'test-agent'), 'ok', 'four wrong, then the right one');
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
select test.eq(api.sign_in_password_refused(current_setting('t.mail2'), 'invalid_credentials', 'test-agent'),
  'wrong_password', 'a wrong password after a sign-in is the first of a new count');
select test.eq(api.sign_in_password_check(current_setting('t.mail2')), 'allowed', 'so nothing is locked');
reset role;

-- no e-mail is checked more than twenty times in fifteen minutes — an unlisted one, or codes asked for
set local role service_role;
select api.sign_in_password_check('made.up.stranger@example.test', 'test-agent') from generate_series(1, 20);
select test.eq(api.sign_in_password_check('made.up.stranger@example.test', 'test-agent'), 'rate_limited',
  'the twenty-first check of an e-mail in fifteen minutes is refused');
reset role;
select set_config('t.am3', test.person('Test Account Manager Three', 'member')::text, true);
select set_config('t.uid3', test.sign_in(current_setting('t.am3')::uuid)::text, true);
select set_config('t.mail3', (select email from core.person_auth where auth_user_id = current_setting('t.uid3')::uuid),
  true);
set local role service_role;
select api.sign_in_check(current_setting('t.mail3')) from generate_series(1, 20);
select test.eq(api.sign_in_check(current_setting('t.mail3')), 'rate_limited', 'and so is the twenty-first code');
reset role;
select test.eq((select count(*)::int from core.sign_in_log where email = current_setting('t.mail3')
                and result = 'rate_limited'), 1, 'the refusal is logged');
