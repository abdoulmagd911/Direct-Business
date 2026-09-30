-- Sabotage: a-new-password-keeps-the-other-devices
-- Breaks: sql:SIGN-11
-- Expect: the two other devices are signed out
-- A new password of your own leaves your other devices signed in (ACC-021): a stolen session outlives the change.
create or replace function core.own_password_set(p_auth_user uuid, p_keep_session uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a core.person_auth;
  keep uuid;
  req uuid;
  n int;
begin
  select * into a from core.person_auth where auth_user_id = p_auth_user;
  if a.id is null or core.sign_in_state(a.email::text) <> 'allowed' then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select d.id into keep from core.device_session d
  where d.auth_session_id = p_keep_session and d.person_id = a.person_id and d.signed_out_at is null;
  req := audit.begin_for(a.person_id, 'person_auth.password_changed', pg_catalog.jsonb_build_object('email', a.email));
  update core.person_auth set must_change_password = false, password_set_at = core.clock(), password_set_by = a.person_id
  where id = a.id;
  n := 0;
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', a.person_id, 'signed_out', n, 'request_id', req);
end
$$;
