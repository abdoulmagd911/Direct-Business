-- Sabotage: grant-execute-to-anon
-- Breaks: sql:GRANTS-01 sql:GRANTS-03
-- Expect: core.riyadh_today()
-- A migration hands a function to callers who are not signed in (A8, M87).
grant usage on schema core to anon;
grant execute on function core.riyadh_today() to anon;
