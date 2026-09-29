-- SIGN-10 — sign-in by e-mail and password (V431, V441, V166): only an admin generates a person's temporary password
-- (a reset is a new generate), with a reason, logged; every sign-in of the person must change it, and every device of
-- the person is signed out; the admin sees who has no password yet. Until the server records the change, the sign-in
-- completes as must_change_password, api.me() says so and every door refuses; the browser can never record the change
-- itself. The emailed code is off unless an admin switches it on: its pre-check answers code_off and logs nothing, and
-- a session a code opened is refused and registers no device. The password door's pre-check logs a refusal, never an
-- allowed e-mail; Auth's refusal is logged with its reason. Made up.
-- Sabotages: supabase/tests/sabotage/a-starting-password-opens-the-app.sql,
--            supabase/tests/sabotage/anyone-sets-a-password.sql,
--            supabase/tests/sabotage/the-browser-clears-its-own-password-flag.sql,
--            supabase/tests/sabotage/the-code-door-stays-open.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.mail', (select email from core.person_auth where auth_user_id = current_setting('t.uid')::uuid), true);
select test.as_person(current_setting('t.am1')::uuid);

-- only an admin, with a reason
select test.raises(format('select api.person_password_set(%L, %L)', current_setting('t.am1'), 'made up: first sign-in'),
  '42501', 'a team member generates no password, not even their own', 'access.needs_admin');
select test.raises('select api.people_without_password()', '42501', 'nor sees who has none', 'access.needs_admin');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(exists (select 1 from jsonb_array_elements(api.people_without_password()) x
                       where x ->> 'person_id' = current_setting('t.am1')),
  'the admin sees who has no password yet');
select test.ok(not exists (select 1 from jsonb_array_elements(api.people_without_password()) x
                           where x ->> 'person_id' = current_setting('t.admin')),
  'themselves aside: a generate signs its person out everywhere');
select test.raises(format('select api.person_password_set(%L, null)', current_setting('t.am1')), 'P0001',
  'a password is generated with its reason', 'common.reason_required');
select set_config('t.set', api.person_password_set(current_setting('t.am1')::uuid, 'made up: first sign-in')::text, true);
select test.eq(current_setting('t.set')::jsonb -> 'auth_user_ids', jsonb_build_array(current_setting('t.uid')),
  'the server is told every sign-in to set it on');
select test.ok(not exists (select 1 from jsonb_array_elements(api.people_without_password()) x
                           where x ->> 'person_id' = current_setting('t.am1')), 'then the person has one');
select test.raises(format('select api.person_password_set(%L, %L)', current_setting('t.am1'), 'made up: again'), 'P0001',
  'a password someone holds — one the owner typed himself too — is kept unless the admin asks', 'person_password.has_one');
select set_config('t.set', api.person_password_set(current_setting('t.am1')::uuid, 'made up: first sign-in', true)::text,
  true);
select test.ok((current_setting('t.set')::jsonb ->> 'request_id') is not null, 'asked for a Reset, it is replaced');
select test.as_owner();
select test.eq((select must_change_password from core.person_auth where auth_user_id = current_setting('t.uid')::uuid), true,
  'the sign-in must change it');
select test.eq((select r.reason || ' · ' || r.label_key from audit.request r
                where r.id = (current_setting('t.set')::jsonb ->> 'request_id')::uuid
                  and r.actor_id = current_setting('t.admin')::uuid),
  'made up: first sign-in · person_auth.password_generated', 'logged as the admin''s, with the reason');
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
  'code_door_off', 'the refusal is logged');
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('auth.code_door_enabled', null, 'true', null, 'made up: the code door for a test');
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

-- nobody, or nobody with a sign-in, gets no password
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_password_set(%L, %L)', gen_random_uuid(), 'made up'), 'P0002',
  'no person, no password', 'common.not_found');
select test.raises(format('select api.person_password_set(%L, %L)', test.person('Test No Sign-in', 'member'), 'made up'),
  'P0001', 'no allowed e-mail, no password', 'person_password.no_sign_in');

-- an auth user found already there — one the owner made in the dashboard with a password he typed himself (V166) — is
-- linked as it is: it holds a password, so no generate replaces it unless an admin asks, and nothing makes it change it
select set_config('t.own', test.person('Test Own Password', 'member')::text, true);
select set_config('t.ouid', test.sign_in(current_setting('t.own')::uuid)::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.person_auth_found(%L)', current_setting('t.ouid')), '42501',
  'a team member marks no sign-in', 'access.needs_admin');
select test.as_person(current_setting('t.admin')::uuid);
select test.ok(exists (select 1 from jsonb_array_elements(api.people_without_password()) x
                       where x ->> 'person_id' = current_setting('t.own')), 'before it is marked, it has none');
select test.eq(api.person_auth_found(current_setting('t.ouid')::uuid) ->> 'marked', '1', 'the server marks it found');
select test.ok(not exists (select 1 from jsonb_array_elements(api.people_without_password()) x
                           where x ->> 'person_id' = current_setting('t.own')),
  'then "Generate for everyone" passes it by');
select test.raises(format('select api.person_password_set(%L, %L)', current_setting('t.own'), 'made up: everyone'),
  'P0001', 'and a generate keeps its password', 'person_password.has_one');
select test.as_owner();
select test.eq((select must_change_password::text || ' · ' || coalesce(password_set_by::text, 'nobody')
                from core.person_auth where auth_user_id = current_setting('t.ouid')::uuid),
  'false · nobody', 'nothing makes its owner change it, and nobody in the app set it');
select test.eq((select count(*)::int from audit.request where label_key = 'person_auth.found_existing'
                and actor_id = current_setting('t.admin')::uuid), 1, 'logged as the admin''s');
