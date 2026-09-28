-- Sabotage: me-lets-a-switched-off-person-in
-- Breaks: sql:ME-02
-- Expect: switched off, not allowed, or removed
-- api.me() answers 'ok' for anyone with a link, active or not (§4).
create or replace function api.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  if not exists (select 1 from core.person_auth a where a.auth_user_id = auth.uid()) then
    return '{"status": "not_listed"}'::jsonb;
  end if;
  return '{"status": "ok"}'::jsonb;
end
$$;
