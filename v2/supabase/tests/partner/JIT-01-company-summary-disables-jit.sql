-- JIT-01 — partner.company_summary runs with JIT off
-- (live failure 6 Nov 2026: the company Finance tab failed with Postgres 57014 statement timeout
-- on every call. The function's RETURN query costs 143,848, above the JIT threshold, so Postgres
-- JIT-compiled its expressions: 3,698 functions, 5.4 s locally, far longer on the Nano. The
-- execution itself is ~25 ms. JIT is off for this function; this test pins that setting so a
-- future regeneration of the function cannot silently bring the timeout back.)
select test.eq(
  (select pg_catalog.count(*)::int from pg_catalog.pg_proc p
   join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'partner' and p.proname = 'company_summary'
     and 'jit=off' = any(p.proconfig)),
  1, 'company_summary runs with JIT off');
