-- Sabotage: a-wallet-word-is-read-in-english-only
-- Breaks: sql:WLT-01
-- Expect: an Arabic wallet word marks its line
-- The wallet words are read in English only, so an Arabic wallet line is counted as revenue (V617).
create or replace function finance.wallet_words() returns text[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(norm.fold(w.name_en)), '{}'::text[])
  from finance.wallet_rule w
  where w.deleted_at is null and w.active and w.kind = 'name_contains' and norm.fold(w.name_en) is not null
$$;
