-- Rollback of D22 (d22-access-follows-page-level.sql): every rule and function back exactly as read from live on 28 Sep.
drop policy if exists bm_write on public.business_merges;
create policy bm_write on public.business_merges for all
  using ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('leads') or can_edit_page('clients')))
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('leads') or can_edit_page('clients')));
drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles for all to authenticated
  using ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')))
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')));
drop policy if exists cdc_insert on public.company_discount_codes;
create policy cdc_insert on public.company_discount_codes for insert to authenticated
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')));
drop policy if exists cdc_update on public.company_discount_codes;
create policy cdc_update on public.company_discount_codes for update to authenticated
  using ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')))
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')));
drop policy if exists company_alias_insert on public.company_name_aliases;
create policy company_alias_insert on public.company_name_aliases for insert to authenticated
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')));
drop policy if exists company_alias_update on public.company_name_aliases;
create policy company_alias_update on public.company_name_aliases for update to authenticated
  using ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')))
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and (can_edit_page('finance') or can_edit_page('clients')));
drop policy if exists money_rules_insert on public.money_exclusion_rules;
create policy money_rules_insert on public.money_exclusion_rules for insert to authenticated
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and can_edit_page('finance'));
drop policy if exists money_rules_update on public.money_exclusion_rules;
create policy money_rules_update on public.money_exclusion_rules for update to authenticated
  using ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and can_edit_page('finance'))
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and can_edit_page('finance'));
drop policy if exists money_item_classes_insert on public.money_item_classes;
create policy money_item_classes_insert on public.money_item_classes for insert to authenticated
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and can_edit_page('finance'));
drop policy if exists money_item_classes_update on public.money_item_classes;
create policy money_item_classes_update on public.money_item_classes for update to authenticated
  using ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and can_edit_page('finance'))
  with check ((app_role() = any (array['admin'::user_role, 'manager'::user_role])) and can_edit_page('finance'));
drop policy if exists finance_cogs_expenses_write on public.finance_cogs_expenses;
create policy finance_cogs_expenses_write on public.finance_cogs_expenses for all
  using (can_edit_page('finance') and (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'operations'::user_role])))
  with check (can_edit_page('finance') and (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'operations'::user_role])));
drop policy if exists finance_transactions_write on public.finance_transactions;
create policy finance_transactions_write on public.finance_transactions for all
  using (can_edit_page('finance') and (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'operations'::user_role])))
  with check (can_edit_page('finance') and (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'operations'::user_role])));
drop policy if exists payment_receipts_write on public.payment_receipts;
create policy payment_receipts_write on public.payment_receipts for all
  using (can_edit_page('finance') and (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'operations'::user_role])))
  with check (can_edit_page('finance') and (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'operations'::user_role])));
drop policy if exists csr_write on public.contact_submissions_review;
create policy csr_write on public.contact_submissions_review for all
  using (app_role() = any (array['admin'::user_role, 'manager'::user_role])) with check (app_role() = any (array['admin'::user_role, 'manager'::user_role]));
drop policy if exists off_write on public.offers;
create policy off_write on public.offers for all
  using (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role, 'team_member'::user_role]))
  with check (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role, 'team_member'::user_role]));
drop policy if exists req_write on public.requests;
create policy req_write on public.requests for all
  using (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role, 'operations'::user_role, 'team_member'::user_role]))
  with check (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role, 'operations'::user_role, 'team_member'::user_role]));
drop policy if exists funnels_write on public.funnels;
create policy funnels_write on public.funnels for all to authenticated
  using (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role]))
  with check (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role]));
drop policy if exists ext_write on public.external_refs;
create policy ext_write on public.external_refs for all
  using (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role, 'team_member'::user_role]))
  with check (app_role() = any (array['admin'::user_role, 'manager'::user_role, 'bd'::user_role, 'team_member'::user_role]));
drop policy if exists kpi_definitions_write on public.kpi_definitions;
create policy kpi_definitions_write on public.kpi_definitions for all to authenticated using (is_manager() and can_edit_page('reports')) with check (is_manager() and can_edit_page('reports'));
drop policy if exists objectives_write on public.objectives;
create policy objectives_write on public.objectives for all to authenticated using (is_manager() and can_edit_page('reports')) with check (is_manager() and can_edit_page('reports'));
drop policy if exists initiatives_write on public.initiatives;
create policy initiatives_write on public.initiatives for all to authenticated using (is_manager() and can_edit_page('reports')) with check (is_manager() and can_edit_page('reports'));
drop policy if exists reports_write on public.reports;
create policy reports_write on public.reports for all using (is_manager()) with check (is_manager());
drop policy if exists report_categories_write on public.report_categories;
create policy report_categories_write on public.report_categories for all using (is_manager()) with check (is_manager());
drop policy if exists periods_write on public.periods;
create policy periods_write on public.periods for all using (app_role() = 'admin'::user_role) with check (app_role() = 'admin'::user_role);
drop policy if exists priorities_write on public.priorities;
create policy priorities_write on public.priorities for all using (is_manager()) with check (is_manager());
drop policy if exists tags_write on public.tags;
create policy tags_write on public.tags for all using (is_manager()) with check (is_manager());
drop policy if exists task_statuses_write on public.task_statuses;
create policy task_statuses_write on public.task_statuses for all using (is_manager()) with check (is_manager());
drop policy if exists work_types_write on public.work_types;
create policy work_types_write on public.work_types for all using (is_manager()) with check (is_manager());
drop policy if exists service_types_write on public.service_types;
create policy service_types_write on public.service_types for all using (is_manager()) with check (is_manager());
drop policy if exists ws_write on public.work_settings;
create policy ws_write on public.work_settings for all using (app_role() = 'admin'::user_role) with check (app_role() = 'admin'::user_role);
drop policy if exists finance_cogs_expenses_read on public.finance_cogs_expenses;
create policy finance_cogs_expenses_read on public.finance_cogs_expenses for select using (app_role() is not null);
drop policy if exists finance_transactions_read on public.finance_transactions;
create policy finance_transactions_read on public.finance_transactions for select using (app_role() is not null);
drop policy if exists payment_receipts_read on public.payment_receipts;
create policy payment_receipts_read on public.payment_receipts for select using (app_role() is not null);
drop policy if exists finance_targets_read on public.finance_targets;
create policy finance_targets_read on public.finance_targets for select using (app_role() is not null);
drop policy if exists promo_codes_read on public.promo_codes;
create policy promo_codes_read on public.promo_codes for select to authenticated using (app_role() is not null);
drop policy if exists company_alias_read on public.company_name_aliases;
create policy company_alias_read on public.company_name_aliases for select to authenticated using (app_role() is not null);
drop policy if exists bm_read on public.business_merges;
create policy bm_read on public.business_merges for select using (app_role() is not null);
drop policy if exists csr_read on public.contact_submissions_review;
create policy csr_read on public.contact_submissions_review for select using (app_role() is not null);
drop policy if exists record_history_read on public.record_history;
create policy record_history_read on public.record_history for select to authenticated using (app_role() = any (array['admin'::user_role, 'manager'::user_role]));
drop policy if exists hist_admin_read on public.app_state_history;
create policy hist_admin_read on public.app_state_history for select using (app_role() = 'admin'::user_role);

create or replace function public.company_doc_readable(p_type text) returns boolean language sql stable security definer set search_path to 'public' as $function$
  select case when p_type in ('iban','agreement') then is_manager() and can_see_page('clients') else can_see_page('clients') end
$function$;

do $d22r$
declare f record; d text;
begin
  for f in select * from (values
      ('public.fn_merge_businesses(uuid,uuid,text,boolean)',
       $n$if not (public.can_edit_page('leads') or public.can_edit_page('clients')) then
    raise exception 'merging companies needs Full on Leads or Clients';$n$,
       $o$if not (app_role() = any(array['admin','manager']::user_role[])) then
    raise exception 'merging companies needs an admin or manager';$o$),
      ('public.fn_unmerge_businesses(uuid)',
       $n$if not (public.can_edit_page('leads') or public.can_edit_page('clients')) then
    raise exception 'undoing a merge needs Full on Leads or Clients';$n$,
       $o$if not (app_role() = any(array['admin','manager']::user_role[])) then
    raise exception 'undoing a merge needs an admin or manager';$o$),
      ('public.save_state(jsonb)', $n$if public.app_role() is null then$n$,
       $o$if public.app_role() not in ('admin','manager','bd','operations','team_member') then$o$),
      ('public.save_state_patch(jsonb)', $n$if public.app_role() is null then$n$,
       $o$if public.app_role() not in ('admin','manager','bd','operations','team_member') then$o$)
    ) v(sig, cur_txt, back_txt)
  loop
    if to_regprocedure(f.sig) is null then continue; end if;
    d := pg_get_functiondef(to_regprocedure(f.sig));
    if position(f.cur_txt in d) = 0 then continue; end if;
    execute replace(d, f.cur_txt, f.back_txt);
  end loop;
end $d22r$;
