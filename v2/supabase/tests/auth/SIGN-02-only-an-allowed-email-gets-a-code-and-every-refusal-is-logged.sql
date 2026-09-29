-- SIGN-02 — before a code is sent, the server asks whether the e-mail may sign in: an unlisted e-mail, a switched-off
-- person, a person not allowed to sign in, a removed person and a removed e-mail are refused with their reason; every
-- answer is in the sign-in log; only the server's secret key (service role) may ask (§4, V59).
-- Sabotage: supabase/tests/sabotage/switched-off-people-get-codes.sql.
select set_config('t.ok', test.person('Test Allowed', 'member')::text, true);
select set_config('t.off', test.person('Test Off', 'member')::text, true);
select set_config('t.nosign', test.person('Test Not Allowed', 'member', 'commercial', false)::text, true);
insert into core.person_email (person_id, email) values
  (current_setting('t.ok')::uuid, 'test.allowed@example.com'),
  (current_setting('t.off')::uuid, 'test.off@example.com'),
  (current_setting('t.nosign')::uuid, 'test.nosign@example.com'),
  (current_setting('t.ok')::uuid, 'test.old@example.com');
update core.person set active = false where id = current_setting('t.off')::uuid;
update core.person_email set deleted_at = now(), delete_reason = 'made up for a test' where email = 'test.old@example.com';
set local role service_role;
select test.eq(api.sign_in_check('Test.Allowed@example.com', 'test-agent'), 'allowed', 'an allowed e-mail, any case');
select test.eq(api.sign_in_check('test.stranger@example.com'), 'not_listed', 'an e-mail nobody holds');
select test.eq(api.sign_in_check('test.off@example.com'), 'switched_off', 'a switched-off person');
select test.eq(api.sign_in_check('test.nosign@example.com'), 'switched_off', 'a person not allowed to sign in');
select test.eq(api.sign_in_check('test.old@example.com'), 'not_listed', 'a removed e-mail');
reset role;
select test.eq((select string_agg(email || ' ' || result, ', ' order by email::text) from core.sign_in_log
  where email::text like 'test.%@example.com'),
  'test.allowed@example.com code_sent, test.nosign@example.com switched_off, test.off@example.com switched_off, '
  'test.old@example.com not_listed, test.stranger@example.com not_listed', 'every answer is logged, e-mails lower-cased');
select test.eq((select person_id from core.sign_in_log where email = 'test.off@example.com'), current_setting('t.off')::uuid,
  'a refusal names the person when there is one');
select test.as_auth(gen_random_uuid());
select test.raises($$select api.sign_in_check('test.allowed@example.com')$$, '42501', 'a signed-in person cannot ask');
select test.as_anon();
select test.raises($$select api.sign_in_check('test.allowed@example.com')$$, '42501', 'nor can anyone not signed in');
