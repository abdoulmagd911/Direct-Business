-- Rollback of clients-promo-import.sql: the two importers go; the mirror table and the promo_codes columns stay (they
-- hold imported data — dropping them is a wipe, which needs the owner's word: D9).
drop function if exists public.fn_payments_clients_import(jsonb, timestamptz, text);
drop function if exists public.fn_promo_codes_import(jsonb, timestamptz, text);
drop function if exists public.payments_pick(anyelement, anyelement, boolean);
-- older copies of this file (before 28 Sep 15:00) also stamped invoices; gone either way
drop trigger if exists trg_fin_inv_b_client_from_email on public.finance_invoices;
drop function if exists public.finance_client_on_write();
drop function if exists public.payments_client_for_email(text);
