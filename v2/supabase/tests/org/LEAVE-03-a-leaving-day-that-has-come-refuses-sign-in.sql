-- LEAVE-03 — a leaving day that has come refuses sign-in (V463, ACC-008), whatever can_sign_in still says: the sign-in
-- page answers switched off before any code or password, a live session is turned away on its next request, and no
-- door takes their requests. Until that day they sign in as before. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-leaver-still-signs-in.sql, supabase/tests/sabotage/a-leavers-session-lives-on.sql.
select set_config('t.am1', test.person('Test Leaving Soon', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.mail', (select email::text from core.person_email
                             where person_id = current_setting('t.am1')::uuid), true);
update core.person set left_on = core.riyadh_today() + 1 where id = current_setting('t.am1')::uuid;

select test.eq(core.sign_in_state(current_setting('t.mail')), 'allowed', 'until their leaving day, they sign in');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'and their session works');
select test.eq(authz.me(), current_setting('t.am1')::uuid, 'as them');

select test.as_owner();
select set_config('v2.test_now', (now() + interval '2 days')::text, true);
select test.eq(core.sign_in_state(current_setting('t.mail')), 'switched_off',
  'their leaving day come, the sign-in page answers switched off');
select test.eq(core.sign_in_password_check(current_setting('t.mail')), 'switched_off', 'before any password');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'switched_off', 'a live session is turned away on its next request');
select test.ok(authz.me() is null, 'and no door takes their requests');
select test.raises('select api.notifications()', '42501', 'not even their own bell', 'auth.no_active_person');
select test.as_owner();
select set_config('v2.test_now', '', true);
