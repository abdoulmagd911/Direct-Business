-- Sabotage: anyone-manages-the-allow-list
-- Breaks: sql:SIGN-07
-- Expect: a team member cannot allow an e-mail
-- The allow-list functions check that someone is signed in, not that they are an admin.
create or replace function authz.require_admin() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return authz.me();
end
$$;
