-- PROF-02 — a display name is never the person's own e-mail (the Architect's order of 14 Oct, from QA 2: My profile's
-- Arabic name showed the e-mail, filled by the browser and saved on blur). Saving one's own e-mail as a display name
-- keeps the box empty, in English and in Arabic, whatever the case or spaces; any other name, or someone else's
-- e-mail, is kept as typed. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-display-name-keeps-the-email.sql.
select set_config('t.am', test.person('Test Profile Person', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am')::uuid)::text, true);
select set_config('t.mail', (select email from core.person_email where person_id = current_setting('t.am')::uuid), true);

select test.as_person(current_setting('t.am')::uuid);
select api.profile_update(jsonb_build_object('display_name_en', 'Made Up Name',
  'display_name_ar', ' ' || upper(current_setting('t.mail')) || ' '));
select test.as_owner();
select test.eq((select jsonb_build_object('en', display_name_en, 'ar', display_name_ar)
                from core.person_profile where person_id = current_setting('t.am')::uuid),
  jsonb_build_object('en', 'Made Up Name', 'ar', null),
  'the Arabic name that is my own e-mail stays empty; a real name is kept');

select set_config('t.v', (select version from core.person_profile where person_id = current_setting('t.am')::uuid)::text, true);
select test.as_person(current_setting('t.am')::uuid);
select api.profile_update(jsonb_build_object('display_name_en', current_setting('t.mail'),
  'display_name_ar', 'اسم مختلق'),
  current_setting('t.v')::int);
select test.as_owner();
select test.eq((select jsonb_build_object('en', display_name_en, 'ar', display_name_ar)
                from core.person_profile where person_id = current_setting('t.am')::uuid),
  jsonb_build_object('en', null, 'ar', 'اسم مختلق'), 'so does the English name');

select set_config('t.v', (select version from core.person_profile where person_id = current_setting('t.am')::uuid)::text, true);
select test.as_person(current_setting('t.am')::uuid);
select api.profile_update(jsonb_build_object('display_name_en', 'someone.else@example.test'),
  current_setting('t.v')::int);
select test.as_owner();
select test.eq((select display_name_en from core.person_profile where person_id = current_setting('t.am')::uuid),
  'someone.else@example.test', 'only the person''s own e-mail is refused as a name');
