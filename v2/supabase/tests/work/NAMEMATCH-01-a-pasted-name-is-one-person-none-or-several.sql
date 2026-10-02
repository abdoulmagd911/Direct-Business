-- NAMEMATCH-01 — a pasted name is matched by the database, never guessed (OLD-059): exactly one person, none, or several.
-- Real names in either language beat nicknames, which beat e-mail prefixes; every spelling folds to one. Every value is
-- made up.
-- The owner's admin account is never matched (QA-214): his name answers his employee account.
-- Sabotages: supabase/tests/sabotage/a-nickname-beats-a-real-name.sql, the-admin-account-matches-a-name.sql.
select set_config('t.a', test.person('Made Up Hana', 'member')::text, true);
select set_config('t.b', test.person('Made Up Omar', 'member')::text, true);
select set_config('t.c', test.person('Made Up Omar', 'member')::text, true);
select set_config('t.d', test.person('Made Up Salem', 'member')::text, true);
select set_config('t.acct', test.person('Made Up Hana', 'admin')::text, true);
update core.person set account = 'admin_account', team_id = null, manager_id = null where id = current_setting('t.acct')::uuid;
update core.person set nickname_en = 'Made Up Hana', full_name_ar = 'ميد أب سالم' where id = current_setting('t.d')::uuid;
insert into core.person_email (person_id, email) values (current_setting('t.b')::uuid, 'made.up.omar1@example.test');
select test.as_person(current_setting('t.a')::uuid);
select set_config('t.m', api.people_match(array['made up hana', 'MADE UP OMAR', 'Nobody Made Up', 'ميد أب سالم',
                                                'made.up.omar1'])::text, true);
select test.eq(current_setting('t.m')::jsonb -> 'made up hana', jsonb_build_object('kind', 'one', 'id', current_setting('t.a')),
  'a real name beats someone''s nickname, and the admin account of the same name is not counted');
select test.eq(current_setting('t.m')::jsonb -> 'MADE UP OMAR' ->> 'kind', 'many', 'two people of one name are several');
select test.eq(current_setting('t.m')::jsonb -> 'Nobody Made Up' ->> 'kind', 'none', 'no one has this name');
select test.eq(current_setting('t.m')::jsonb -> 'ميد أب سالم' ->> 'id', current_setting('t.d'), 'the Arabic name matches');
select test.eq(current_setting('t.m')::jsonb -> 'made.up.omar1' ->> 'id', current_setting('t.b'),
  'an e-mail prefix is the last resort');
