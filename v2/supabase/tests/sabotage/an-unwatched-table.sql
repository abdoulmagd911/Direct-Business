-- Sabotage: an-unwatched-table
-- Breaks: sql:SCHEMA-01
-- Expect: core.rogue_table: no stamp trigger
-- A migration adds a business table without audit.track(): its changes are never logged or undoable.
create table core.rogue_table (id uuid primary key default gen_random_uuid(), version int not null default 1);
alter table core.rogue_table enable row level security;
