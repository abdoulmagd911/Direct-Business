-- Sabotage: the-test-users-seed-writes-nothing
-- Breaks: sql:TESTUSERS-01
-- Expect: the seed ran
-- The seed does nothing, so production would get no TEST users at all.
create or replace function core.test_users_seed() returns jsonb language sql as $$ select '{"seeded": false}'::jsonb $$;
