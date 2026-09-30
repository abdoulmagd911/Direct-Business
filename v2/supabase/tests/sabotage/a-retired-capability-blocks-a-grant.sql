-- Sabotage: a-retired-capability-blocks-a-grant
-- Breaks: sql:ACC-09
-- Expect: an admin clears an override on a capability retired since
-- Granting a retired capability counts as granting more than you hold, so its old grants cannot even be cleared.
create or replace function core.access_can_grant(p_me uuid, p_capability text) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not authz.can_of(p_me, p_capability) then
    raise exception using errcode = '42501', message = 'access.above_your_level',
      detail = pg_catalog.jsonb_build_object('capability', p_capability)::text;
  end if;
end
$$;
