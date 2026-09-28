-- SIGN-01 — the allow-list: an e-mail belongs to one live person (whatever its letter case), a person may hold several
-- (their .com and their .net) with one primary, and only staff hold any — System and Import never (§4, V2, V44).
-- Sabotage: supabase/tests/sabotage/two-people-share-an-email.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Other', 'member')::text, true);
insert into core.person_email (person_id, email, is_primary)
values (current_setting('t.am1')::uuid, 'test.am1@example.com', true),
       (current_setting('t.am1')::uuid, 'test.am1@example.net', false);
select test.raises(format('insert into core.person_email (person_id, email) values (%L, %L)',
  current_setting('t.am2'), 'TEST.AM1@example.com'), '23505', 'the same e-mail, in capitals, for another person');
select test.raises(format('insert into core.person_email (person_id, email, is_primary) values (%L, %L, true)',
  current_setting('t.am1'), 'test.am1b@example.com'), '23505', 'a second primary e-mail');
select test.raises(format('insert into core.person_email (person_id, email) values (%L, %L)',
  core.import_person_id(), 'test.import@example.com'), 'P0001', 'Import holds no e-mail', 'person_email.not_staff');
select test.raises(format('insert into core.person_email (person_id, email) values (%L, %L)',
  current_setting('t.am2'), 'not an email'), '23514', 'an e-mail has an @ and a domain');
update core.person_email set deleted_at = now(), delete_reason = 'made up for a test' where email = 'test.am1@example.net';
insert into core.person_email (person_id, email) values (current_setting('t.am2')::uuid, 'test.am1@example.net');
select test.eq((select person_id from core.person_email where email = 'test.am1@example.net' and deleted_at is null),
  current_setting('t.am2')::uuid, 'a removed e-mail may go to someone else');
