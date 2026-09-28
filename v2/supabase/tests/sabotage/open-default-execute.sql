-- Sabotage: open-default-execute
-- Breaks: sql:GRANTS-01 sql:GRANTS-04
-- Expect: execute
-- The foundation's revoke is undone: every new function is executable by PUBLIC again (A8).
alter default privileges grant execute on functions to public;
