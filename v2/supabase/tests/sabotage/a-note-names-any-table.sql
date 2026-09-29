-- Sabotage: a-note-names-any-table
-- Breaks: sql:REF-01
-- Expect: a note on a table that is no record type is refused
-- Notes name any table and id at all: the database no longer checks them against the registry.
drop trigger entity_ref on core.note;
