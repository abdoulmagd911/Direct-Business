-- Sabotage: access-change-while-switched
-- Breaks: sql:SWITCH-01
-- Expect: no access change while switched, even as TEST Admin
-- A Settings page may be changed while switched.
create or replace function authz.require(p_page text, p_level core.level) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- V656: no access change while switched to a TEST user: nothing above view on a Settings page but one's own profile
  if authz.level_of(me, p_page) < p_level then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', p_page, 'level', p_level)::text;
  end if;
  return me;
end
$$;
