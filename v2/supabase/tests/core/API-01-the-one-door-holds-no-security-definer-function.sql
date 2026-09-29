-- API-01 — the one door holds no security-definer function (V124): every function in `api` — the only schema the
-- Data API exposes — runs as its caller, so nothing reachable from a browser bypasses row-level security by itself;
-- what must (a write, a sign-in step) lives in an unexposed schema and asks who is calling there (SEC-02). The rule
-- of Supabase's advisor 0029 and its agent guidance, checked on every database built from zero.
-- Sabotage: supabase/tests/sabotage/a-definer-function-in-the-door.sql.
do $$
declare
  definers text;
  n int;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace where ns.nspname = 'api';
  select string_agg(format('api.%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)), E'\n    ' order by 1)
    into definers
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'api' and p.prosecdef;
  perform test.ok(n >= 10, format('found only %s api functions — the test would prove nothing', n));
  perform test.ok(definers is null, format(E'api functions that run as their owner:\n    %s', definers));
end $$;
