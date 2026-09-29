-- REF-01 — a note, a file link or a follow names its record by table and id (§3.4): the database itself refuses a
-- table that is not a record type of the registry, and a record that does not exist, whoever writes the row.
-- Sabotage: supabase/tests/sabotage/a-note-names-any-table.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.act(current_setting('t.head')::uuid);
select test.raises($$insert into core.note (entity_table, entity_id, kind, body)
  values ('core.no_such_table', gen_random_uuid(), 'comment', 'Made up')$$, 'P0001',
  'a note on a table that is no record type is refused', 'entity.unknown_table');
select test.raises($$insert into core.note (entity_table, entity_id, kind, body)
  values ('audit.request', gen_random_uuid(), 'comment', 'Made up')$$, 'P0001',
  'nor one on a table the registry does not list', 'entity.unknown_table');
select test.raises($$insert into core.note (entity_table, entity_id, kind, body)
  values ('partner.partner', gen_random_uuid(), 'comment', 'Made up')$$, 'P0002',
  'nor on a record that does not exist', 'common.not_found');
select test.raises(format($$insert into core.file_link (file_id, entity_table, entity_id, purpose)
  values (%L, 'core.no_such_table', %L, 'attachment')$$, gen_random_uuid(), gen_random_uuid()), 'P0001',
  'a file link is checked the same way', 'entity.unknown_table');
select test.raises(format($$insert into notify.follow (person_id, entity_table, entity_id)
  values (%L, 'partner.partner', %L)$$, current_setting('t.head'), gen_random_uuid()), 'P0002',
  'and a follow', 'common.not_found');
select test.done();
