-- Sabotage: a-switched-off-wallet-rule-still-counts
-- Breaks: sql:WLT-01
-- Expect: a switched-off wallet rule stops counting at once
-- A wallet rule an admin switched off still takes its lines out of revenue (V617).
create or replace function finance.wallet_words() returns text[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(k.word), '{}'::text[])
  from finance.wallet_rule w
  cross join lateral (values (norm.fold(w.name_en)), (norm.fold(w.name_ar))) k(word)
  where w.deleted_at is null and w.kind = 'name_contains' and k.word is not null
$$;
