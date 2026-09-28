-- SIGN-06 — removing one of a person's allowed e-mails refuses that e-mail's sign-in at once, even in a session already
-- open, while the person's other e-mail keeps working (§4 step 5).
-- Sabotage: supabase/tests/sabotage/a-removed-email-still-signs-in.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.uid2', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.sid2', test.start_session(current_setting('t.uid2')::uuid)::text, true);
update core.person_email set deleted_at = now(), delete_reason = 'made up for a test'
where email = (select email from core.person_auth where auth_user_id = current_setting('t.uid')::uuid);
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'not_listed', 'the removed e-mail''s open session is refused');
select test.ok(authz.me() is null, 'and can read or write nothing');
select test.as_auth(current_setting('t.uid2')::uuid, current_setting('t.sid2')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'the other e-mail still signs the person in');
