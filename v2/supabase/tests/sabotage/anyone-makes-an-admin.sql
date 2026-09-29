-- Sabotage: anyone-makes-an-admin
-- Breaks: sql:ACC-03
-- Expect: a head with Full on access cannot make an admin
-- Everyone counts as an admin when access changes are checked.
create or replace function authz.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select authz.me() is not null $$;
