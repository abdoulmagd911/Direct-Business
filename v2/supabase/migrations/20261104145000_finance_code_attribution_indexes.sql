-- FK-01 fix, 4 Nov 2026: finance.code_attribution's foreign keys had no usable
-- index of their own — the only index was a partial unique index on
-- (code_id, partner_id) where deleted_at is null, which FK-01 does not count.
-- Add a plain index per foreign-key column (code_id, partner_id, created_by).
-- New migration (forward-only): no pushed migration is edited.
create index code_attribution_code_idx on finance.code_attribution (code_id);
create index code_attribution_partner_idx on finance.code_attribution (partner_id);
create index code_attribution_created_by_idx on finance.code_attribution (created_by);

-- SCHEMA-01 + ENT-01 fix, same migration: the code tables were created without
-- row-level security and without the stamp/capture triggers, so SCHEMA-01
-- (every business table watched and guarded) and ENT-01 (every watched table
-- is a record type, and vice versa — the registry sync already lists both
-- tables) both fail on them. Both tables already have a uuid id and a version.
alter table finance.code_use enable row level security;
alter table finance.code_attribution enable row level security;
select audit.track('finance.code_use'::regclass);
select audit.track('finance.code_attribution'::regclass);
