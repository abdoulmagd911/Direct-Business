-- Sabotage: require-asks-nothing
-- Breaks: sql:ACC-06
-- Expect: a team member at Own on Finance was let through to Full
-- authz.require() checks that someone is signed in, not their level.
create or replace function authz.require(p_page text, p_level core.level) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return me;
end
$$;
