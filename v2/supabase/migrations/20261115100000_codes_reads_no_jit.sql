-- Landing 28 — the Discount Codes reads run with JIT off (15 Nov 2026: the code detail on
-- /codes failed on and off, and one retry took about two minutes).
-- finance.codes_list, finance.codes_detail and finance.codes_by_company had no jit = off
-- anywhere and read finance.money_row, whose expressions Postgres JIT-compiles on every
-- execution (seconds; the execution itself is milliseconds). codes_detail is the heaviest:
-- five totals subqueries plus a ledger with four correlated subqueries per use row, all over
-- finance.money_row. Same pattern as L25 (JIT-03) and L27 (JIT-04).
-- Config only: no signature, grant, or type change, so database.types.ts is unchanged.
--
-- No redefinition here: CREATE OR REPLACE FUNCTION silently drops a function's jit = off
-- (see 20261106170000_company_summary_single_pass.sql:24–27), so any future migration that
-- redefines one of these three functions must re-apply its ALTER ... SET jit = off in the same
-- file. JIT-05 pins the setting so a future regeneration cannot silently bring the failures back.
alter function finance.codes_list() set jit = off;
alter function finance.codes_detail(uuid) set jit = off;
alter function finance.codes_by_company() set jit = off;
