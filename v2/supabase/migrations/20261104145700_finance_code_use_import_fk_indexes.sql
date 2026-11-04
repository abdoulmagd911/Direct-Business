-- FK-01 fix, 4 Nov 2026: the remaining foreign keys without a usable index.
-- Like code_attribution before them, these tables only had partial indexes
-- (where deleted_at is null) or none, which FK-01 does not count because it
-- requires a non-partial index whose leading columns are the key's own.
-- One plain index per listed key (code_attribution was already fixed in
-- 20261104145000 and is not listed anymore). New migration (forward-only).
create index code_use_code_idx on finance.code_use (code_id);
create index code_use_invoice_idx on finance.code_use (invoice_id);
create index code_use_created_by_idx on finance.code_use (created_by);
create index import_batch_partner_idx on work.import_batch (partner_id);
create index import_batch_created_by_idx on work.import_batch (created_by);
create index import_record_partner_idx on work.import_record (partner_id);
create index import_record_batch_idx on work.import_record (batch_id);
create index import_record_created_by_idx on work.import_record (created_by);
