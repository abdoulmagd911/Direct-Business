-- Sabotage: storage-takes-any-path
-- Breaks: sql:FILE-01
-- Expect: another person cannot write to a pending path
-- Storage takes an object at any path from anyone signed in, not only the path its writer registered.
create or replace function authz.can_upload_file(p_bucket text, p_path text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select authz.me() is not null
$$;
