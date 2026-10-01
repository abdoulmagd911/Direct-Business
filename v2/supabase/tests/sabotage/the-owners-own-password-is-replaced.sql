-- Sabotage: the-owners-own-password-is-replaced
-- Breaks: sql:SIGN-10
-- Expect: then "Generate for everyone" passes it by
-- An auth user found already there is linked as if it held no password (V166): "Generate for everyone" replaces the passwords the owner typed himself.
create or replace function core.person_auth_found(p_auth_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  req uuid;
  n int;
begin
  req := audit.begin('ui', 'person_auth.found_existing', null, null);
  update core.person_auth set password_set_at = password_set_at
  where auth_user_id = p_auth_user and password_set_at is null;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('marked', n, 'request_id', req);
end
$$;
