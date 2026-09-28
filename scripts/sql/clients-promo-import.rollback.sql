-- Rollback of clients-promo-import.sql: the importers and the email link go; the mirror table and the promo_codes
-- columns stay (they hold imported data — dropping them is a wipe, which needs the owner's word: D9).
drop trigger if exists trg_fin_inv_b_client_from_email on public.finance_invoices;
drop function if exists public.finance_client_on_write();
drop function if exists public.fn_payments_clients_import(jsonb, timestamptz, text);
drop function if exists public.fn_promo_codes_import(jsonb, timestamptz, text);
drop function if exists public.payments_client_for_email(text);
drop function if exists public.payments_pick(anyelement, anyelement, boolean);
