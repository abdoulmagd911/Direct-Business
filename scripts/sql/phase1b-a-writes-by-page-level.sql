-- Phase 1b, part A — writes follow the page level (D2), steps 0–4 of the 1b order. 2026-09-25.
--
-- Rule of the change: a write to a table belongs to one page, and is allowed when the writer's
-- level on that page is FULL (can_edit_page). Reading stays open to every signed-in employee —
-- the owner's standing rule "reading is shared, writing is not" (ROLES_AND_ACCESS.md, 2026-08-13).
-- Where the old role rule was STRICTER than the page grid, the role floor is kept alongside the
-- page check, so nobody gains a power they did not have (seed from today); those are marked
-- "role floor kept" and listed in DECISIONS D2 for the owner to lift or keep.
-- Nobody loses anything they use: the only live accounts that lose a write are team members on
-- tables of pages they cannot open (Proposals, Operations, Projects, Bookings, Airlines,
-- Suppliers, Generator, Events) — every one of those tables except ksa_events holds no row a
-- team member ever wrote, and no screen offers them the write.
-- Rollback: phase1b-a-writes-by-page-level-rollback.sql.

-- ---------------------------------------------------------------- step 0
-- the manager's starting grid includes the Generator (owner-approved 2026-09-25; the one live
-- manager was given it the same day)
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;

-- app_state_bak (Settings → backups): was open to any signed-in account for every command.
-- Adding a backup stays open to any active account (every browser's one-time upload of its old
-- local backups lands here — core-06 bkMigrateLocalToSupabase — and that upload READS BACK what it
-- wrote to confirm it, so reading stays open to any active account too: a backup is a copy of the
-- workspace every signed-in person already loads). Changing and deleting backups follow Settings.
drop policy if exists app_state_bak_auth on public.app_state_bak;
create policy app_state_bak_read   on public.app_state_bak for select to authenticated using (public.app_role() is not null);
create policy app_state_bak_insert on public.app_state_bak for insert to authenticated with check (public.app_role() is not null);
create policy app_state_bak_update on public.app_state_bak for update to authenticated using (public.can_edit_page('settings')) with check (public.can_edit_page('settings'));
create policy app_state_bak_delete on public.app_state_bak for delete to authenticated using (public.can_edit_page('settings'));

-- finance_targets: two write rules that ADDED UP (admin/manager, and admin/manager/team_member).
-- One rule now: full on Finance — the same eleven people who could write before.
drop policy if exists fin_tgt_write on public.finance_targets;
drop policy if exists finance_targets_write on public.finance_targets;
create policy finance_targets_write on public.finance_targets for all using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));

-- ---------------------------------------------------------------- step 1 — admin-only pages and the unused register tables
drop policy if exists app_projects_write on public.app_projects;
create policy app_projects_write on public.app_projects for all using (public.can_edit_page('projects')) with check (public.can_edit_page('projects'));
drop policy if exists app_bookings_write on public.app_bookings;
create policy app_bookings_write on public.app_bookings for all using (public.can_edit_page('bookings')) with check (public.can_edit_page('bookings'));
drop policy if exists app_invoices_write on public.app_invoices;
create policy app_invoices_write on public.app_invoices for all using (public.can_edit_page('invoices')) with check (public.can_edit_page('invoices'));
drop policy if exists air_write on public.airlines;
create policy air_write on public.airlines for all using (public.can_edit_page('airlines')) with check (public.can_edit_page('airlines'));
drop policy if exists prov_write on public.providers;
create policy prov_write on public.providers for all using (public.can_edit_page('vendors')) with check (public.can_edit_page('vendors'));
drop policy if exists sop_write on public.sops;
create policy sop_write on public.sops for all using (public.can_edit_page('sopsla')) with check (public.can_edit_page('sopsla'));
drop policy if exists sla_write on public.slas;
create policy sla_write on public.slas for all using (public.can_edit_page('sopsla')) with check (public.can_edit_page('sopsla'));

-- ---------------------------------------------------------------- step 2 — Proposals, Operations, Generator
drop policy if exists app_offers_write on public.app_offers;
create policy app_offers_write on public.app_offers for all using (public.can_edit_page('offers')) with check (public.can_edit_page('offers'));
drop policy if exists app_requests_write on public.app_requests;
create policy app_requests_write on public.app_requests for all using (public.can_edit_page('ops')) with check (public.can_edit_page('ops'));

drop policy if exists generated_documents_insert on public.generated_documents;
create policy generated_documents_insert on public.generated_documents for insert with check (public.can_edit_page('documents'));
drop policy if exists generated_documents_update on public.generated_documents;
create policy generated_documents_update on public.generated_documents for update using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists company_identity_write on public.company_identity;
create policy company_identity_write on public.company_identity for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists company_profile_sections_write on public.company_profile_sections;
create policy company_profile_sections_write on public.company_profile_sections for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists contract_clauses_write on public.contract_clauses;
create policy contract_clauses_write on public.contract_clauses for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists tts_write on public.tender_template_sections;
create policy tts_write on public.tender_template_sections for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists service_fee_scenarios_write on public.service_fee_scenarios;
create policy service_fee_scenarios_write on public.service_fee_scenarios for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists csf_write on public.client_service_fees;
create policy csf_write on public.client_service_fees for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));
drop policy if exists ca_write on public.company_achievements;
create policy ca_write on public.company_achievements for all using (public.can_edit_page('documents')) with check (public.can_edit_page('documents'));

drop policy if exists company_docs_write on storage.objects;
create policy company_docs_write on storage.objects for insert with check (bucket_id = 'company-docs' and public.can_edit_page('documents'));
drop policy if exists company_docs_update on storage.objects;
create policy company_docs_update on storage.objects for update using (bucket_id = 'company-docs' and public.can_edit_page('documents'));

-- a document number is only handed to someone who may issue documents
create or replace function public.next_document_number(p_family text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare y integer := extract(year from now())::integer; n integer;
begin
  if app_role() is null then raise exception 'not allowed'; end if;
  if not public.can_edit_page('documents') then
    raise exception 'Only someone with full control of the Generator can issue a document number.' using errcode = '42501';
  end if;
  insert into document_counters(family, year, last_n) values (upper(p_family), y, 1)
    on conflict (family, year) do update set last_n = document_counters.last_n + 1
    returning last_n into n;
  return upper(p_family) || '-' || y || '-' || lpad(n::text, 3, '0');
end $function$;

-- ---------------------------------------------------------------- step 3 — Events
-- was: any authenticated account (including a sign-up nobody approved) could read AND write
drop policy if exists ksa_events_auth_write on public.ksa_events;
drop policy if exists ksa_events_team_read on public.ksa_events;
create policy ksa_events_team_read on public.ksa_events for select to authenticated using (public.app_role() is not null);
create policy ksa_events_write on public.ksa_events for all to authenticated using (public.can_edit_page('events')) with check (public.can_edit_page('events'));
drop policy if exists signups_team_all on public.ksa_event_signups;
create policy signups_read on public.ksa_event_signups for select to authenticated using (public.app_role() is not null);
create policy signups_write on public.ksa_event_signups for all to authenticated using (public.can_edit_page('events')) with check (public.can_edit_page('events'));

-- ---------------------------------------------------------------- step 4 — the Finance leftovers
-- role floor kept (was admin/manager/operations — stricter than the Finance grid, which gives the
-- seven employees full): nobody gains a write here
drop policy if exists finance_transactions_write on public.finance_transactions;
create policy finance_transactions_write on public.finance_transactions for all
  using (public.can_edit_page('finance') and public.app_role() in ('admin','manager','operations'))
  with check (public.can_edit_page('finance') and public.app_role() in ('admin','manager','operations'));
drop policy if exists payment_receipts_write on public.payment_receipts;
create policy payment_receipts_write on public.payment_receipts for all
  using (public.can_edit_page('finance') and public.app_role() in ('admin','manager','operations'))
  with check (public.can_edit_page('finance') and public.app_role() in ('admin','manager','operations'));
drop policy if exists finance_cogs_expenses_write on public.finance_cogs_expenses;
create policy finance_cogs_expenses_write on public.finance_cogs_expenses for all
  using (public.can_edit_page('finance') and public.app_role() in ('admin','manager','operations'))
  with check (public.can_edit_page('finance') and public.app_role() in ('admin','manager','operations'));
drop policy if exists promo_codes_write on public.promo_codes;
create policy promo_codes_write on public.promo_codes for all using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
drop policy if exists promo_codes_read on public.promo_codes;
create policy promo_codes_read on public.promo_codes for select to authenticated using (public.app_role() is not null);

drop policy if exists expenses_write on storage.objects;
create policy expenses_write on storage.objects for insert with check (bucket_id = 'expenses' and public.can_edit_page('finance'));
drop policy if exists payment_proofs_write on storage.objects;
create policy payment_proofs_write on storage.objects for insert with check (bucket_id = 'payment-proofs' and public.can_edit_page('finance'));
-- role floor kept: changing or deleting a money document stays admin/manager
drop policy if exists expenses_update on storage.objects;
create policy expenses_update on storage.objects for update using (bucket_id = 'expenses' and public.can_edit_page('finance') and public.app_role() in ('admin','manager'));
drop policy if exists expenses_delete on storage.objects;
create policy expenses_delete on storage.objects for delete using (bucket_id = 'expenses' and public.can_edit_page('finance') and public.app_role() in ('admin','manager'));
drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_update on storage.objects for update using (bucket_id = 'payment-proofs' and public.can_edit_page('finance') and public.app_role() in ('admin','manager'));
drop policy if exists payment_proofs_delete on storage.objects;
create policy payment_proofs_delete on storage.objects for delete using (bucket_id = 'payment-proofs' and public.can_edit_page('finance') and public.app_role() in ('admin','manager'));
