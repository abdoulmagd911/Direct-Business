-- Undo phase1b-a-writes-by-page-level.sql: every rule below is exactly what was live before it
-- (read from pg_policies / pg_proc on 2026-09-25).
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;
drop policy if exists app_state_bak_read on public.app_state_bak;
drop policy if exists app_state_bak_insert on public.app_state_bak;
drop policy if exists app_state_bak_update on public.app_state_bak;
drop policy if exists app_state_bak_delete on public.app_state_bak;
create policy app_state_bak_auth on public.app_state_bak for all to authenticated using (true) with check (true);

drop policy if exists finance_targets_write on public.finance_targets;
create policy finance_targets_write on public.finance_targets for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
create policy fin_tgt_write on public.finance_targets for all using (app_role() = any (array['admin','manager','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','team_member']::user_role[]));

drop policy if exists app_projects_write on public.app_projects;
create policy app_projects_write on public.app_projects for all using (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[]));
drop policy if exists app_bookings_write on public.app_bookings;
create policy app_bookings_write on public.app_bookings for all using (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[]));
drop policy if exists app_invoices_write on public.app_invoices;
create policy app_invoices_write on public.app_invoices for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists air_write on public.airlines;
create policy air_write on public.airlines for all using (app_role() = any (array['admin','manager','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','operations','team_member']::user_role[]));
drop policy if exists prov_write on public.providers;
create policy prov_write on public.providers for all using (app_role() = any (array['admin','manager','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','operations','team_member']::user_role[]));
drop policy if exists sop_write on public.sops;
create policy sop_write on public.sops for all using (app_role() = any (array['admin','manager','operations']::user_role[])) with check (app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists sla_write on public.slas;
create policy sla_write on public.slas for all using (app_role() = any (array['admin','manager','operations']::user_role[])) with check (app_role() = any (array['admin','manager','operations']::user_role[]));

drop policy if exists app_offers_write on public.app_offers;
create policy app_offers_write on public.app_offers for all using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists app_requests_write on public.app_requests;
create policy app_requests_write on public.app_requests for all using (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[]));
drop policy if exists generated_documents_insert on public.generated_documents;
create policy generated_documents_insert on public.generated_documents for insert with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists generated_documents_update on public.generated_documents;
create policy generated_documents_update on public.generated_documents for update using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists company_identity_write on public.company_identity;
create policy company_identity_write on public.company_identity for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists company_profile_sections_write on public.company_profile_sections;
create policy company_profile_sections_write on public.company_profile_sections for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists contract_clauses_write on public.contract_clauses;
create policy contract_clauses_write on public.contract_clauses for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists tts_write on public.tender_template_sections;
create policy tts_write on public.tender_template_sections for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists service_fee_scenarios_write on public.service_fee_scenarios;
create policy service_fee_scenarios_write on public.service_fee_scenarios for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists csf_write on public.client_service_fees;
create policy csf_write on public.client_service_fees for all using (app_role() = any (array['admin','manager','bd']::user_role[])) with check (app_role() = any (array['admin','manager','bd']::user_role[]));
drop policy if exists ca_write on public.company_achievements;
create policy ca_write on public.company_achievements for all using (app_role() = any (array['admin','manager','bd']::user_role[])) with check (app_role() = any (array['admin','manager','bd']::user_role[]));
drop policy if exists company_docs_write on storage.objects;
create policy company_docs_write on storage.objects for insert with check ((bucket_id = 'company-docs') and (app_role() = any (array['admin','manager']::user_role[])));
drop policy if exists company_docs_update on storage.objects;
create policy company_docs_update on storage.objects for update using ((bucket_id = 'company-docs') and (app_role() = any (array['admin','manager']::user_role[])));
create or replace function public.next_document_number(p_family text)
 returns text language plpgsql security definer set search_path to 'public' as $function$
declare y integer := extract(year from now())::integer; n integer;
begin
  if app_role() is null then raise exception 'not allowed'; end if;
  insert into document_counters(family, year, last_n) values (upper(p_family), y, 1)
    on conflict (family, year) do update set last_n = document_counters.last_n + 1
    returning last_n into n;
  return upper(p_family) || '-' || y || '-' || lpad(n::text, 3, '0');
end $function$;

drop policy if exists ksa_events_team_read on public.ksa_events;
drop policy if exists ksa_events_write on public.ksa_events;
create policy ksa_events_team_read on public.ksa_events for select to authenticated using (true);
create policy ksa_events_auth_write on public.ksa_events for all to authenticated using (true) with check (true);
drop policy if exists signups_read on public.ksa_event_signups;
drop policy if exists signups_write on public.ksa_event_signups;
create policy signups_team_all on public.ksa_event_signups for all to authenticated using (true) with check (true);

drop policy if exists finance_transactions_write on public.finance_transactions;
create policy finance_transactions_write on public.finance_transactions for all using (app_role() = any (array['admin','manager','operations']::user_role[])) with check (app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists payment_receipts_write on public.payment_receipts;
create policy payment_receipts_write on public.payment_receipts for all using (app_role() = any (array['admin','manager','operations']::user_role[])) with check (app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists finance_cogs_expenses_write on public.finance_cogs_expenses;
create policy finance_cogs_expenses_write on public.finance_cogs_expenses for all using (app_role() = any (array['admin','manager','operations']::user_role[])) with check (app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists promo_codes_write on public.promo_codes;
create policy promo_codes_write on public.promo_codes for all using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists promo_codes_read on public.promo_codes;
create policy promo_codes_read on public.promo_codes for select to authenticated using (true);
drop policy if exists expenses_write on storage.objects;
create policy expenses_write on storage.objects for insert with check ((bucket_id = 'expenses') and (app_role() is not null));
drop policy if exists payment_proofs_write on storage.objects;
create policy payment_proofs_write on storage.objects for insert with check ((bucket_id = 'payment-proofs') and (app_role() is not null));
drop policy if exists expenses_update on storage.objects;
create policy expenses_update on storage.objects for update using ((bucket_id = 'expenses') and (app_role() = any (array['admin','manager']::user_role[])));
drop policy if exists expenses_delete on storage.objects;
create policy expenses_delete on storage.objects for delete using ((bucket_id = 'expenses') and (app_role() = any (array['admin','manager']::user_role[])));
drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_update on storage.objects for update using ((bucket_id = 'payment-proofs') and (app_role() = any (array['admin','manager']::user_role[])));
drop policy if exists payment_proofs_delete on storage.objects;
create policy payment_proofs_delete on storage.objects for delete using ((bucket_id = 'payment-proofs') and (app_role() = any (array['admin','manager']::user_role[])));
