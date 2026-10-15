-- Sabotage: a-profile-save-keeps-quiet-about-the-names
-- Breaks: sql:PROF-03
-- Expect: the answer says the e-mail was not kept
-- The save answers with its version only, so the screen goes on showing the e-mail it did not keep (QA-567).
create or replace function api.profile_update(p_changes jsonb, p_version int default null, p_person_version int default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.profile_update(p_changes, p_version, p_person_version) $$;
