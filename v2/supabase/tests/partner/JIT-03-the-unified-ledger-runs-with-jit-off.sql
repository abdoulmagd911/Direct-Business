-- JIT-03 — the company Finance tab's read path runs with JIT off (Landing 25, F-A/A1).
-- The tab reads finance.unified_ledger, which wraps finance.ledger, and the Overview tiles read
-- finance.period_figures. Like partner.company_summary (JIT-01/JIT-02), those RETURN queries are above the JIT
-- threshold on a database with data, so Postgres would JIT-compile their expressions — seconds locally, far
-- longer on the Nano — while the execution itself is milliseconds. jit = off is set on all three, and this test
-- pins the setting so a future regeneration of any of them cannot silently bring the timeout back.
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'unified_ledger'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.unified_ledger runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'ledger'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.ledger runs with JIT off');
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance' and p.proname = 'period_figures'
     and 'jit=off' = any(p.proconfig)),
  1, 'finance.period_figures runs with JIT off');
