-- Sabotage: an-unindexed-foreign-key
-- Breaks: sql:FK-01
-- Expect: core.person (manager_id)
-- A foreign key loses its index: joins and checks on it scan the table.
drop index core.person_manager_id_fk;
