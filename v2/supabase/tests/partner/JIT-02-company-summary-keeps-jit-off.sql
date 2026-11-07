-- JIT-02 — partner.company_summary still runs with JIT off after the fix23 single-pass restructure
-- (mirrors JIT-01: the fix21 setting is load-bearing — the same query with JIT on takes ~66 s locally —
-- so the restructure must not lose it when the function is regenerated).
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'partner' and p.proname = 'company_summary'
     and 'jit=off' = any(p.proconfig)),
  1, 'company_summary still runs with JIT off');
