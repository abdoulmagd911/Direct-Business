-- ENT-01 fix, 4 Nov 2026: work.import_batch and work.import_record are
-- watched (audit.track in 20261104130000) and guarded, but the registry
-- sync (20261104130100) never registered them as record types, so ENT-01
-- (every watched table is a record type, and vice versa) fails on them.
-- Register both, owned by their creator, on the Finance page — the same
-- shape as the code tables' rows. New migration (forward-only): no pushed
-- migration is edited. Timestamp 14:55 sits after fix5's 14:50 and before
-- the pilot's 15:00, so the pilot's ordering check still passes later.
insert into core.entity (key, table_name, page_key, owners, is_list, private, visible, level, history, rule_only, active) values
  ('import_batch', 'work.import_batch', 'finance', 'created_by', false, false, null, null, false, false, true),
  ('import_record', 'work.import_record', 'finance', 'created_by', false, false, null, null, false, false, true);
