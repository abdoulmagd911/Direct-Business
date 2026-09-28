-- Rollback of D24: the two views go; the three lists are KEPT (never deleted — they hold who added what), only no longer
-- read. Finance then draws its old service table (js/25 falls back when money_service_rows cannot be read).
drop view if exists public.money_service_rows;
drop view if exists public.money_line_services;
