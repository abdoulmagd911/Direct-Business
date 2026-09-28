-- SEC-02 — a security-definer function runs past row-level security, so every one that a request role may execute
-- must itself ask who is calling (auth.uid(), an authz.* check, or audit.begin(), which refuses a sign-in with no
-- active person) — Supabase's rule for definer functions (A6, §5).
-- Sabotage: supabase/tests/sabotage/a-definer-function-that-asks-nobody.sql.
do $$
declare
  blind text;
  n int;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = any (test.v2_schemas()) and p.prosecdef
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'));
  select string_agg(format('%s.%s(%s)', ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
                    E'\n    ' order by 1) into blind
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = any (test.v2_schemas()) and p.prosecdef
    and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
    and p.prosrc !~ '(auth\.uid\(\)|authz\.[a-z_]+\(|audit\.begin\()';
  perform test.ok(n >= 2, format('found only %s callable definer functions — the test would prove nothing', n));
  perform test.ok(blind is null, format(E'callable definer functions that never ask who is calling:\n    %s', blind));
end $$;
