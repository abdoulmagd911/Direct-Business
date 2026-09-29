-- Sabotage: signing-out-leaves-the-device-live
-- Breaks: sql:SIGN-08
-- Expect: the phone's next request is refused
-- Signing out deletes the Supabase session and logs it, but never marks the device: it keeps answering until its
-- access token expires.
create or replace function core.end_devices(p_person uuid, p_device uuid, p_except uuid, p_reason text, p_by uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d core.device_session;
  n int := 0;
begin
  for d in
    select s.* from core.device_session s
    where s.person_id = p_person and s.signed_out_at is null
      and (p_device is null or s.id = p_device)
      and (p_except is null or s.id <> p_except)
  loop
    delete from auth.sessions where id = d.auth_session_id;
    insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, detail)
    values (d.person_id, d.auth_user_id, d.auth_session_id,
            (select a.email from core.person_auth a where a.auth_user_id = d.auth_user_id), 'email', 'signed_out',
            p_reason);
    n := n + 1;
  end loop;
  return n;
end
$$;
