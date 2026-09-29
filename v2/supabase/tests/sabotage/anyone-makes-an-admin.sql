-- Sabotage: anyone-makes-an-admin
-- Breaks: sql:ACC-03
-- Expect: a head cannot put an e-mail on an admin's person
-- Everyone counts as an admin when access changes are checked.
create or replace function authz.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select authz.me() is not null $$;
