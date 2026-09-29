-- Sabotage: the-matrix-is-open-to-all
-- Breaks: sql:ACC-07
-- Expect: a team member cannot read the matrix
-- The access matrix answers anyone signed in.
create or replace function core.access_matrix() returns jsonb
language sql stable security definer set search_path = ''
as $$ select pg_catalog.jsonb_build_object('roles', '[]'::jsonb, 'asked_by', authz.me()) $$;
