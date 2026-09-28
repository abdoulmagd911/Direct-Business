-- golive-reset.sql (2026-09-27) — the data reset the owner ordered on 26 Sep ("Reset now (approved): full backup
-- first (kept outside the DB), dry run with counts per table, then wipe data and logs; keep logins, access levels,
-- settings, KPI definitions"). DECISIONS D9; the table list is BACKLOG "Go-live reset", item 1. The FINAL go-live reset
-- is a separate occasion and still needs the owner's go on the day.
--
-- One function, one switch, so the dry run and the real run are the SAME code:
--   select public.golive_reset(false);  -- DRY RUN: does the whole wipe, counts every table before and after, then
--                                       --          raises the report as an error, which undoes everything
--   select public.golive_reset(true);   -- the real run: the same, kept; returns the report
-- Callable only by the database owner (the SQL editor / execute_sql) — not by any signed-in person.
--
-- WIPED (business records and logs): companies, contacts, activities, client IDs, discount-code links, company
--   files (rows), website-form review rows, requests, offers, bookings/invoices/offers/projects/requests mirrors,
--   merges, external refs, the finance mirror (invoices and their item lines, transactions, client links, expenses,
--   the Payments cost lines and per-invoice facts of the cost import (D25), capture tables,
--   receipts, proof documents), generated documents, share links, tasks and everything under them, projects,
--   work-finance links, achievements/report lines, reports, proofs (rows), event sign-ups, and the logs:
--   record_history, ksa_events_audit, app_state_history, and app_state's own `audit` and `recents` lists.
--   Numbering back to 001: document_counters.last_n = 0; any locked month unlocked.
-- KEPT: logins (auth, app_users, access_allowlist, owner_name_preference), access levels (in app_users), the team list
--   and departments, KPI definitions, objectives, initiatives and KPI targets, finance targets, periods, every lookup
--   (statuses, priorities, work types, service types, report categories, tags, funnels, work settings), settings
--   (app_settings, app_state's settings/templates/pricing), Direct's own content (company identity, profile sections,
--   company achievements, contract clauses, tender template sections, service-fee scenarios, blob section pages), the
--   reference registers (airlines, providers, ksa_events, sops, slas, promo_codes, master_db_companies — their link to a
--   company is cleared), and every old backup table (*_snapshot_*, *_prewipe_*, *_seedwipe_*, *_backup_*, *_bak,
--   world30_*) — untouched.
-- The guards (no-delete triggers, history triggers) are switched off for this transaction only
-- (session_replication_role = replica), which is also why the logs are not refilled by the wipe itself.

create or replace function public.golive_reset(p_apply boolean) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare
  wipe text[] := array['activities','app_bookings','app_invoices','app_offers','app_projects','app_requests',
    'business_merges','businesses','client_profiles','client_service_fees','company_discount_codes','company_documents',
    'contact_submissions_review','contacts','evidence_files','external_refs','finance_client_links','finance_cogs_expenses',
    'finance_expense_gate_capture','finance_expense_lines','finance_expense_lines_capture','finance_expenses',
    'finance_invoice_lines','finance_invoices','finance_payments_facts',
    'finance_transactions','generated_documents','ksa_event_signups','offers','payment_receipts','projects',
    'proof_documents','record_history','ksa_events_audit','app_state_history','report_entries','reports','requests',
    'share_links','task_checklist','task_comments','task_dependencies','task_files','task_people','task_status_log',
    'task_tags','tasks','work_finance_links'];
  t text; n bigint; before jsonb := '{}'; after jsonb := '{}'; report jsonb; missing text[] := '{}';
begin
  foreach t in array wipe loop
    if to_regclass('public.' || quote_ident(t)) is null then missing := missing || t; end if;
  end loop;
  if array_length(missing, 1) > 0 then raise exception 'golive_reset: tables not found: %', missing; end if;

  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind = 'r' order by 1 loop
    execute format('select count(*) from public.%I', t) into n; before := before || jsonb_build_object(t, n);
  end loop;

  set local session_replication_role = replica;   -- guards and history triggers off, this transaction only
  update public.master_db_companies set linked_business_id = null where linked_business_id is not null;
  update public.promo_codes set partner_business_id = null where partner_business_id is not null;
  foreach t in array wipe loop execute format('delete from public.%I', t); end loop;
  update public.document_counters set last_n = 0;
  update public.periods set locked_at = null where locked_at is not null;
  update public.app_state set data = data || jsonb_build_object('audit', '[]'::jsonb, 'recents', '[]'::jsonb);
  set local session_replication_role = origin;

  for t in select c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
            where s.nspname = 'public' and c.relkind = 'r' order by 1 loop
    execute format('select count(*) from public.%I', t) into n; after := after || jsonb_build_object(t, n);
  end loop;

  report := jsonb_build_object('applied', p_apply, 'at', now(),
    'wiped', (select jsonb_object_agg(k, jsonb_build_object('before', before->k, 'after', after->k)) from unnest(wipe) k),
    'changed_but_kept', (select coalesce(jsonb_object_agg(k, jsonb_build_object('before', before->k, 'after', after->k)), '{}')
                           from jsonb_object_keys(before) k where k <> all(wipe) and before->k <> after->k),
    'kept_rows', (select sum((after->>k)::bigint) from jsonb_object_keys(after) k where k <> all(wipe)),
    'counters', (select jsonb_object_agg(family || year, last_n) from public.document_counters),
    'app_state_audit', (select jsonb_array_length(data->'audit') from public.app_state limit 1));
  if not p_apply then raise exception 'GOLIVE_RESET_DRY_RUN %', report::text; end if;
  return report;
end $$;

revoke all on function public.golive_reset(boolean) from public, anon, authenticated, service_role;
