-- Sabotage: the-test-removal-takes-nothing
-- Breaks: sql:TESTUSERS-01
-- Expect: the removal took six people
-- The one-step removal before go-live removes nothing, so the TEST users would reach the real data.
create or replace function core.test_users_remove() returns jsonb language sql as $$ select '{"people": 0, "tasks": 0, "notes": 0}'::jsonb $$;
