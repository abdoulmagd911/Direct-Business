-- SIGN-10 — sign-in by e-mail and password (V166): only an admin gives a sign-in a starting password or resets it,
-- with a reason, logged; a reset signs every device of the person out; the sign-in then must change its password —
-- until the server records the change, it completes as must_change_password, api.me() says so and every door refuses;
-- the browser can never record the change itself. The emailed code is off unless an admin switches it on: its
-- pre-check answers code_off and logs nothing, and a session a code opened is refused and registers no device. The
-- password door's pre-check logs a refusal, never an allowed e-mail; Auth's refusal is logged with its reason. Made up.
-- Sabotages: supabase/tests/sabotage/a-starting-password-opens-the-app.sql,
--            supabase/tests/sabotage/anyone-sets-a-password.sql,
--            supabase/tests/sabotage/the-browser-clears-its-own-password-flag.sql,
--            supabase/tests/sabotage/the-code-door-stays-open.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.mail', (select email from core.person_auth where auth_user_id = current_setting('t.uid')::uuid), true);
select set_config('t.eid', (select id::text from core.person_email where email = current_setting('t.mail')), true);
select test.as_person(current_setting('t.am1')::uuid);

-- only an admin, with a reason
select test.raises(format('select api.person_password_set(%L, %L)', current_setting('t.eid'), 'made up: first sign-in'),
  '42501', 'a team member sets no password, not even their own', 'access.needs_admin');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_password_set(%L, null)', current_setting('t.eid')), 'P0001',
  'a password is set with its reason', 'common.reason_required');
select set_config('t.set', api.person_password_set(current_setting('t.eid')::uuid, 'made up: first sign-in')::text, true);
select test.eq(current_setting('t.set')::jsonb ->> 'auth_user_id', current_setting('t.uid'),
  'the server is told which sign-in to set the password on');
select test.as_owner();
select test.eq((select must_change_password from core.person_auth where auth_user_id = current_setting('t.uid')::uuid), true,
  'the sign-in must change it');
select test.eq((select r.reason || ' · ' || r.label_key from audit.request r
                where r.id = (current_setting('t.set')::jsonb ->> 'request_id')::uuid
                  and r.actor_id = current_setting('t.admin')::uuid),
  'made up: first sign-in · person_auth.password_set', 'logged as the admin''s, with the reason');
select test.eq((select count(*)::int from core.device_session where person_id = current_setting('t.am1')::uuid
                and signed_out_at is null), 0, 'and every device of the person is signed out');

-- the first sign-in: nothing but the change
select set_config('t.sid', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.uid'), 'role', 'authenticated',
  'session_id', current_setting('t.sid'), 'amr', json_build_array(json_build_object('method', 'password')))::text, true);
set local role authenticated;
select test.eq(api.sign_in_complete('email', 'Test browser', 'test-agent'), 'must_change_password',
  'the sign-in completes as must_change_password');
select test.eq(api.me() ->> 'status', 'must_change_password', 'api.me() says so');
select test.ok(authz.me() is null, 'and nobody is behind it yet');
select test.raises('select api.org()', '42501', 'so every door refuses', 'auth.no_active_person');
select test.raises(format('select api.password_changed(%L)', current_setting('t.uid')), '42501',
  'the browser cannot record the change itself');
reset role;
set local role service_role;
select test.eq(api.password_changed(current_setting('t.uid')::uuid) ->> 'person_id', current_setting('t.am1'),
  'the server records it once Auth took the new password');
reset role;
select test.eq((select r.actor_id::text from audit.request r where r.label_key = 'person_auth.password_changed'
                order by r.at desc limit 1), current_setting('t.am1'), 'logged as the person''s own');
set local role authenticated;
select test.eq(api.me() ->> 'status', 'ok', 'then the same device is in');
select test.eq(authz.me(), current_setting('t.am1')::uuid, 'as the person');
reset role;
select test.eq((select method from core.sign_in_log where auth_session_id = current_setting('t.sid')::uuid),
  'password', 'the log names the door');

-- the emailed code is off unless an admin switches it on
select set_config('t.n', (select count(*)::text from core.sign_in_log), true);
set local role service_role;
select test.eq(api.sign_in_methods(), '{"code": false, "password": true}'::jsonb, 'the page offers the password alone');
select test.eq(api.sign_in_check(current_setting('t.mail')), 'code_off', 'no code is sent');
reset role;
select test.eq((select count(*)::text from core.sign_in_log), current_setting('t.n'), 'and nothing is logged');
select set_config('t.sid2', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.uid'), 'role', 'authenticated',
  'session_id', current_setting('t.sid2'), 'amr', json_build_array(json_build_object('method', 'otp')))::text, true);
set local role authenticated;
select test.eq(api.sign_in_complete('email'), 'code_off', 'a session a code opened is no sign-in');
select test.ok(authz.me() is null, 'it reaches nothing');
reset role;
select test.ok(not exists (select 1 from core.device_session where auth_session_id = current_setting('t.sid2')::uuid),
  'and registers no device');
select test.eq((select detail from core.sign_in_log where auth_session_id = current_setting('t.sid2')::uuid),
  'code_sign_in_off', 'the refusal is logged');
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('auth.code_sign_in', null, 'true', null, 'made up: the code door for a test');
select test.as_owner();
set local role service_role;
select test.eq(api.sign_in_check(current_setting('t.mail')), 'allowed', 'switched on, the code door opens');
reset role;

-- the password door's pre-check and Auth's refusal
set local role service_role;
select test.eq(api.sign_in_password_check('made.up.nobody@example.test', 'test-agent'), 'not_listed',
  'an unlisted e-mail is refused');
select test.eq(api.sign_in_password_check(current_setting('t.mail')), 'allowed', 'an allowed one passes');
select api.sign_in_password_refused(current_setting('t.mail'), 'invalid_credentials', 'test-agent');
reset role;
select test.eq((select string_agg(result || '/' || coalesce(detail, '-') || '/' || method, ', ' order by result)
                from core.sign_in_log where method = 'password' and auth_session_id is null),
  'not_listed/-/password, provider_error/invalid_credentials/password',
  'the refusal and Auth''s reason are logged; an allowed e-mail is not, until it signs in');

-- an admin's reset of a removed e-mail finds nothing
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_password_set(%L, %L)', gen_random_uuid(), 'made up'), 'P0002',
  'no allowed e-mail, no password', 'common.not_found');
