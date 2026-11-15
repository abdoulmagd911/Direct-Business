-- JIT-04 — the Finance Overview reads run with JIT off (Landing 27).
-- Four of the six Overview reads had no jit = off and read finance.money_row /
-- finance.money_service_row, whose expressions Postgres JIT-compiles on every execution
-- (7–14 s; the execution itself is milliseconds). L25 set it on the company-tab path only
-- (finance.period_figures, finance.ledger, finance.unified_ledger — JIT-03); this test pins
-- the other six functions that read the same views on the Overview path, so a future
-- regeneration of any of them cannot silently bring the timeout back. CREATE OR REPLACE
-- FUNCTION silently drops the setting, so a redefinition must re-apply it in the same file.
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'income_by_service'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.income_by_service runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'health'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.health runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'not_invoiced'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.not_invoiced runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'closed_months'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.closed_months runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'period_units'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.period_units runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'company_not_counted'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.company_not_counted runs with JIT off');
