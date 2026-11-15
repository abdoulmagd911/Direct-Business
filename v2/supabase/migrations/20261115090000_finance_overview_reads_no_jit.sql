-- Landing 27 — the Finance Overview reads run with JIT off (15 Nov 2026 incident).
-- Four of the six Overview reads had no jit = off and read finance.money_row /
-- finance.money_service_row, whose expressions Postgres JIT-compiles on every execution
-- (7–14 s; the execution itself is milliseconds). L25 set it on the company-tab path only.
-- Config only: no signature, grant, or type change, so database.types.ts is unchanged.
-- The two further functions are the same pattern on the same views: finance.period_units
-- (reads money_row; used after saving an invoice) and finance.company_not_counted (reads
-- money_row; L25's own new function, also never given jit = off).
--
-- No redefinition here: CREATE OR REPLACE FUNCTION silently drops a function's jit = off
-- (see 20261106170000_company_summary_single_pass.sql:24–27), so any future migration that
-- redefines one of these six functions must re-apply its ALTER ... SET jit = off in the same
-- file. JIT-04 pins the setting so a future regeneration cannot silently bring the timeout back.
alter function finance.income_by_service(date, date) set jit = off;
alter function finance.health(date, date) set jit = off;
alter function finance.not_invoiced(date, date) set jit = off;
alter function finance.closed_months() set jit = off;
alter function finance.period_units(date, date) set jit = off;
alter function finance.company_not_counted(uuid, date, date) set jit = off;
