-- JIT-05 — the Discount Codes reads run with JIT off (Landing 28).
-- finance.codes_list, finance.codes_detail and finance.codes_by_company read finance.money_row,
-- whose expressions Postgres JIT-compiles on every execution (seconds; the execution itself is
-- milliseconds) — the code detail on /codes failed on and off for it. This test pins the setting
-- on the three functions, so a future regeneration of any of them cannot silently bring the
-- failures back. CREATE OR REPLACE FUNCTION silently drops the setting, so a redefinition must
-- re-apply it in the same file.
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'codes_list'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.codes_list runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'codes_detail'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.codes_detail runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'codes_by_company'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.codes_by_company runs with JIT off');
