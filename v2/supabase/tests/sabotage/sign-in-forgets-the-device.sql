-- Sabotage: sign-in-forgets-the-device
-- Breaks: sql:SIGN-03
-- Expect: now api.me() answers
-- The completed sign-in is logged but its device is never registered, so the session is never recognised.
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
  if p_provider not in ('email', 'google', 'zoom') then
    raise exception using errcode = 'P0001', message = 'sign_in.unknown_provider', detail = p_provider;
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  st := case when a.id is null then 'not_listed' else core.sign_in_state(a.email::text) end;
  insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, user_agent)
  values (a.person_id, uid, sid, a.email, p_provider, case st when 'allowed' then 'ok' else st end, p_user_agent);
  if st <> 'allowed' then
    return st;
  end if;
  if not (p_provider = any (a.providers)) then
    update core.person_auth set providers = providers || p_provider where id = a.id;
  end if;
  return 'ok';
end
$$;
