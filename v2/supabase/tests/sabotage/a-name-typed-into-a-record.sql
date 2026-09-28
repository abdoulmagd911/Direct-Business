-- Sabotage: a-name-typed-into-a-record
-- Breaks: sql:NAMES-01
-- Expect: core.rogue_task.owner_name
-- A table keeps a person's name as text instead of their id (A20).
create table core.rogue_task (id uuid primary key, owner_name text);
