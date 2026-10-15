-- QA-567 (the Architect's order of 14 Oct, after #259): a display name that is the person's own e-mail is kept empty
-- (PROF-02), but My profile kept showing the e-mail typed until the page's data came back. The save now answers with
-- the two display names it kept, so the screen shows what was stored at once. Same name, arguments and result type;
-- the answer only gains two keys. Forward-only.

-- The signed-in person's display names as stored (their own row only; null when they have no profile row yet).
-- Volatile, so it reads after the save made in the same statement rather than from the statement's first snapshot.
create function core.profile_kept_names() returns jsonb
language sql volatile security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar)
  from core.person_profile pr
  where pr.person_id = authz.me()
$$;

revoke all on function core.profile_kept_names() from public;
grant execute on function core.profile_kept_names() to authenticated;

create or replace function api.profile_update(p_changes jsonb, p_version int default null, p_person_version int default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select core.profile_update(p_changes, p_version, p_person_version)
         || coalesce(core.profile_kept_names(), '{}'::jsonb)
$$;
