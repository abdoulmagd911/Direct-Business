-- Sabotage: the-people-list-hides-the-test-mark
-- Breaks: sql:TESTUSERS-07
-- Expect: six rows say they are TEST users
-- The People list stops saying which rows are TEST users, so the screen would never offer the switch.
create or replace function core.people() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', p.id, 'full_name_en', p.full_name_en,
    'is_test', false)), '[]'::jsonb) from core.person p where p.kind = 'staff' and p.deleted_at is null
$$;
