-- Sabotage: doors-are-not-recorded
-- Breaks: sql:SIGN-04
-- Expect: each link records the door it used
-- The doors a sign-in used are no longer recorded on its link.
create or replace function core.sign_in_complete(p_provider text default 'email', p_device_label text default null,
                                     p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := core.jwt_session_id();
  a core.person_auth;
  st text;
begin
  if uid is null or sid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  if p_provider is distinct from 'email' then
    raise exception using errcode = 'P0001', message = 'sign_in.unknown_provider', detail = p_provider;
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  st := case when a.id is null then 'not_listed' else core.sign_in_state(a.email::text) end;
  insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, user_agent)
  values (a.person_id, uid, sid, a.email, p_provider, case st when 'allowed' then 'ok' else st end, p_user_agent);
  if st <> 'allowed' then
    return st;
  end if;
  insert into core.device_session (person_id, auth_user_id, auth_session_id, device_label, user_agent,
                                   signed_in_at, last_seen_at)
  values (a.person_id, uid, sid, p_device_label, p_user_agent, core.clock(), core.clock())
  on conflict (auth_session_id) do nothing;
  return 'ok';
end
$$;
