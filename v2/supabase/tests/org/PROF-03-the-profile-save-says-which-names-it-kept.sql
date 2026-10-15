-- PROF-03 — the profile save says which display names it kept (QA-567, the Architect's order of 14 Oct): my own e-mail
-- typed as a name is answered as empty (PROF-02 keeps it so), a real name as typed, so My profile shows what was
-- stored at once. The answer holds my own names only. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-profile-save-keeps-quiet-about-the-names.sql.
select set_config('t.am', test.person('Test Kept Person', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am')::uuid)::text, true);
select set_config('t.mail', (select email from core.person_email where person_id = current_setting('t.am')::uuid), true);
select set_config('t.other', test.person('Test Other Person', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.r', api.profile_update(jsonb_build_object('display_name_en', 'Made Up Name',
  'display_name_ar', upper(current_setting('t.mail'))))::text, true);
select test.eq(current_setting('t.r')::jsonb - 'version' - 'person_version' - 'request_id',
  jsonb_build_object('display_name_en', 'Made Up Name', 'display_name_ar', null),
  'the answer says the e-mail was not kept and the real name was');
select test.ok((current_setting('t.r')::jsonb ? 'version') and (current_setting('t.r')::jsonb ? 'request_id'),
  'and still carries the version and the request');

select test.as_owner();
update core.person_profile set display_name_en = 'Someone Else Entirely'
where person_id = current_setting('t.other')::uuid;
insert into core.person_profile (person_id, display_name_en)
select current_setting('t.other')::uuid, 'Someone Else Entirely'
where not exists (select 1 from core.person_profile where person_id = current_setting('t.other')::uuid);
select set_config('t.v', (select version from core.person_profile where person_id = current_setting('t.am')::uuid)::text, true);
select test.as_person(current_setting('t.am')::uuid);
select test.eq(api.profile_update(jsonb_build_object('display_name_ar', 'اسم مختلق'), current_setting('t.v')::int)
                 ->> 'display_name_en', 'Made Up Name', 'the names in the answer are mine, never another person''s');
