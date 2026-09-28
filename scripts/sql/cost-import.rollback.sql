-- Rollback of cost-import.sql: the insert trigger and the import function go; the two tables are KEPT (they hold what
-- was imported, and dropping them would lose it) — a cost already written into finance_invoices stays as it is.
drop trigger if exists trg_fin_inv_a_cost_from_lines on public.finance_invoices;
drop function if exists public.finance_cost_on_insert();
drop function if exists public.fn_cost_import(jsonb, jsonb, timestamptz, timestamptz, timestamptz, text);
drop function if exists public.finance_cost_from_lines(text);
