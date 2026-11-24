-- Sabotage: a-repeated-expense-line-is-counted-twice
-- Breaks: sql:CKY-01
-- Expect: the repeated line is counted once
-- No two expense lines ever share a key, so a line repeated in the file is counted twice.
create or replace function work.expense_key(p_amount numeric, p_approved text, p_type text) returns text
language sql volatile set search_path = '' as $$
  select pg_catalog.to_char(pg_catalog.round(p_amount, 2), 'FM999999999999990.00') || '|' || pg_catalog.gen_random_uuid()::text || '|'
$$;
