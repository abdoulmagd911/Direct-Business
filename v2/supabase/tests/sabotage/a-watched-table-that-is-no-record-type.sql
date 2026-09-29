-- Sabotage: a-watched-table-that-is-no-record-type
-- Breaks: sql:ENT-01
-- Expect: every watched table is a record type
-- The registry forgets one record type: the change log still watches teams, but nothing says whose they are.
update core.entity set active = false where key = 'team';
