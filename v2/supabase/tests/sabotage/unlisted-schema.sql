-- Sabotage: unlisted-schema
-- Breaks: sql:GRANTS-02
-- Expect: rogue
-- A migration makes a schema the snapshot and the write refusals do not cover.
create schema rogue;
