-- D22 — every access rule follows the page level set in Team & Access (owner, 28 Sep, via the oversight). Rollback:
-- d22-access-follows-page-level.rollback.sql. No data changes.
--
-- The rule: a person's level on a page (None / View / Own / Full, set by hand in Team & Access) decides what the database
-- lets them read and change. page_level() already makes an admin Full everywhere (the owner: "admins are always Full and
-- can't be limited"). The ROLE is kept only for managing people (app_users, access_allowlist, team_members, departments,
-- team_member_assists, the Team & Access functions) — those rules are not touched here.
--
-- Changed:
--   1. writes that asked for a role on top of Full now ask for Full only (money rules, item names, company merges, client
--      IDs and codes, expenses, transactions, receipts, KPI definitions, objectives and initiatives, the task lists);
--   2. writes that asked for a role INSTEAD of a page now ask for Full on the page that owns the table;
--   3. reads of tables one page owns now ask for that page (money → Finance, change history → Activity, backups →
--      Settings, contact-form review → Leads, codes and name aliases → Finance or Clients). Lists several pages show
--      (company names, task statuses, periods…) stay readable by everyone signed in;
--   4. IBAN and agreement files ask for Full on Finance (they are money documents; the role no longer decides); merging
--      companies asks for Full on Leads or Clients; the workspace save no longer refuses a role — each section is still
--      guarded by its own page (blob_section_writable).
-- NOT changed, on purpose — deciding about OTHER people's work is managing people (the owner's exception), so it stays
-- with admins and managers exactly as today: reassigning a task to someone else, crediting or moving an achievement to
-- someone else, seeing everyone's tasks (can_assign_to, can_manage_task, can_edit_entry, can_see_task, can_see_project,
-- tasks_insert, projects_*), and setting a person's or department's KPI target (kpi_targets_write). Live, every team
-- member is on Full for Tasks: without this line each of them could reassign colleagues' work and credit achievements
-- to anyone.

-- =====================================================================
-- 1 + 2. writes: Full on the page, no role
-- =====================================================================
drop policy if exists bm_write on public.business_merges;
create policy bm_write on public.business_merges for all
  using (public.can_edit_page('leads') or public.can_edit_page('clients'))
  with check (public.can_edit_page('leads') or public.can_edit_page('clients'));

drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles for all to authenticated
  using (public.can_edit_page('finance') or public.can_edit_page('clients'))
  with check (public.can_edit_page('finance') or public.can_edit_page('clients'));

drop policy if exists cdc_insert on public.company_discount_codes;
create policy cdc_insert on public.company_discount_codes for insert to authenticated
  with check (public.can_edit_page('finance') or public.can_edit_page('clients'));
drop policy if exists cdc_update on public.company_discount_codes;
create policy cdc_update on public.company_discount_codes for update to authenticated
  using (public.can_edit_page('finance') or public.can_edit_page('clients'))
  with check (public.can_edit_page('finance') or public.can_edit_page('clients'));

drop policy if exists company_alias_insert on public.company_name_aliases;
create policy company_alias_insert on public.company_name_aliases for insert to authenticated
  with check (public.can_edit_page('finance') or public.can_edit_page('clients'));
drop policy if exists company_alias_update on public.company_name_aliases;
create policy company_alias_update on public.company_name_aliases for update to authenticated
  using (public.can_edit_page('finance') or public.can_edit_page('clients'))
  with check (public.can_edit_page('finance') or public.can_edit_page('clients'));

drop policy if exists money_rules_insert on public.money_exclusion_rules;
create policy money_rules_insert on public.money_exclusion_rules for insert to authenticated
  with check (public.can_edit_page('finance'));
drop policy if exists money_rules_update on public.money_exclusion_rules;
create policy money_rules_update on public.money_exclusion_rules for update to authenticated
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));

drop policy if exists money_item_classes_insert on public.money_item_classes;
create policy money_item_classes_insert on public.money_item_classes for insert to authenticated
  with check (public.can_edit_page('finance'));
drop policy if exists money_item_classes_update on public.money_item_classes;
create policy money_item_classes_update on public.money_item_classes for update to authenticated
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));

drop policy if exists finance_cogs_expenses_write on public.finance_cogs_expenses;
create policy finance_cogs_expenses_write on public.finance_cogs_expenses for all
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
drop policy if exists finance_transactions_write on public.finance_transactions;
create policy finance_transactions_write on public.finance_transactions for all
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
drop policy if exists payment_receipts_write on public.payment_receipts;
create policy payment_receipts_write on public.payment_receipts for all
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));

drop policy if exists csr_write on public.contact_submissions_review;
create policy csr_write on public.contact_submissions_review for all
  using (public.can_edit_page('leads')) with check (public.can_edit_page('leads'));
drop policy if exists off_write on public.offers;
create policy off_write on public.offers for all
  using (public.can_edit_page('offers')) with check (public.can_edit_page('offers'));
drop policy if exists req_write on public.requests;
create policy req_write on public.requests for all
  using (public.can_edit_page('ops')) with check (public.can_edit_page('ops'));
drop policy if exists funnels_write on public.funnels;
create policy funnels_write on public.funnels for all to authenticated
  using (public.can_edit_page('leads')) with check (public.can_edit_page('leads'));
drop policy if exists ext_write on public.external_refs;
create policy ext_write on public.external_refs for all
  using (public.can_edit_page('sync')) with check (public.can_edit_page('sync'));

-- Reports' lists and targets: Full on Reports
drop policy if exists kpi_definitions_write on public.kpi_definitions;
create policy kpi_definitions_write on public.kpi_definitions for all to authenticated
  using (public.can_edit_page('reports')) with check (public.can_edit_page('reports'));
drop policy if exists objectives_write on public.objectives;
create policy objectives_write on public.objectives for all to authenticated
  using (public.can_edit_page('reports')) with check (public.can_edit_page('reports'));
drop policy if exists initiatives_write on public.initiatives;
create policy initiatives_write on public.initiatives for all to authenticated
  using (public.can_edit_page('reports')) with check (public.can_edit_page('reports'));
drop policy if exists reports_write on public.reports;
create policy reports_write on public.reports for all
  using (public.can_edit_page('reports')) with check (public.can_edit_page('reports'));
drop policy if exists report_categories_write on public.report_categories;
create policy report_categories_write on public.report_categories for all
  using (public.can_edit_page('reports')) with check (public.can_edit_page('reports'));
drop policy if exists periods_write on public.periods;
create policy periods_write on public.periods for all
  using (public.can_edit_page('reports')) with check (public.can_edit_page('reports'));

-- Tasks' lists: Full on Tasks
drop policy if exists priorities_write on public.priorities;
create policy priorities_write on public.priorities for all
  using (public.can_edit_page('tasks')) with check (public.can_edit_page('tasks'));
drop policy if exists tags_write on public.tags;
create policy tags_write on public.tags for all
  using (public.can_edit_page('tasks')) with check (public.can_edit_page('tasks'));
drop policy if exists task_statuses_write on public.task_statuses;
create policy task_statuses_write on public.task_statuses for all
  using (public.can_edit_page('tasks')) with check (public.can_edit_page('tasks'));
drop policy if exists work_types_write on public.work_types;
create policy work_types_write on public.work_types for all
  using (public.can_edit_page('tasks')) with check (public.can_edit_page('tasks'));
drop policy if exists service_types_write on public.service_types;
create policy service_types_write on public.service_types for all
  using (public.can_edit_page('tasks')) with check (public.can_edit_page('tasks'));

-- work settings: Full on Settings
drop policy if exists ws_write on public.work_settings;
create policy ws_write on public.work_settings for all
  using (public.can_edit_page('settings')) with check (public.can_edit_page('settings'));

-- =====================================================================
-- 3. reads of tables one page owns
-- =====================================================================
drop policy if exists finance_cogs_expenses_read on public.finance_cogs_expenses;
create policy finance_cogs_expenses_read on public.finance_cogs_expenses for select using (public.can_see_page('finance'));
drop policy if exists finance_transactions_read on public.finance_transactions;
create policy finance_transactions_read on public.finance_transactions for select using (public.can_see_page('finance'));
drop policy if exists payment_receipts_read on public.payment_receipts;
create policy payment_receipts_read on public.payment_receipts for select using (public.can_see_page('finance'));
drop policy if exists finance_targets_read on public.finance_targets;
create policy finance_targets_read on public.finance_targets for select using (public.can_see_page('finance'));
drop policy if exists promo_codes_read on public.promo_codes;
create policy promo_codes_read on public.promo_codes for select to authenticated
  using (public.can_see_page('finance') or public.can_see_page('clients'));
drop policy if exists company_alias_read on public.company_name_aliases;
create policy company_alias_read on public.company_name_aliases for select to authenticated
  using (public.can_see_page('finance') or public.can_see_page('clients'));
drop policy if exists bm_read on public.business_merges;
create policy bm_read on public.business_merges for select
  using (public.can_see_page('leads') or public.can_see_page('clients') or public.can_see_page('finance'));
drop policy if exists csr_read on public.contact_submissions_review;
create policy csr_read on public.contact_submissions_review for select using (public.can_see_page('leads'));
drop policy if exists record_history_read on public.record_history;
create policy record_history_read on public.record_history for select to authenticated using (public.can_see_page('activity'));
drop policy if exists hist_admin_read on public.app_state_history;
create policy hist_admin_read on public.app_state_history for select using (public.can_see_page('settings'));

-- =====================================================================
-- 4. functions
-- =====================================================================
create or replace function public.company_doc_readable(p_type text) returns boolean language sql stable security definer set search_path to 'public' as $function$
  select case when p_type in ('iban','agreement') then can_edit_page('finance') else can_see_page('clients') end
$function$;

-- the long functions: only their role check is swapped, in place; the change stops if that exact text is not found
do $d22$
declare f record; d text; n text;
begin
  for f in select * from (values
      ('public.fn_merge_businesses(uuid,uuid,text,boolean)',
       $o$if not (app_role() = any(array['admin','manager']::user_role[])) then
    raise exception 'merging companies needs an admin or manager';$o$,
       $n$if not (public.can_edit_page('leads') or public.can_edit_page('clients')) then
    raise exception 'merging companies needs Full on Leads or Clients';$n$),
      ('public.fn_unmerge_businesses(uuid)',
       $o$if not (app_role() = any(array['admin','manager']::user_role[])) then
    raise exception 'undoing a merge needs an admin or manager';$o$,
       $n$if not (public.can_edit_page('leads') or public.can_edit_page('clients')) then
    raise exception 'undoing a merge needs Full on Leads or Clients';$n$),
      ('public.save_state(jsonb)',
       $o$if public.app_role() not in ('admin','manager','bd','operations','team_member') then$o$,
       $n$if public.app_role() is null then$n$),
      ('public.save_state_patch(jsonb)',
       $o$if public.app_role() not in ('admin','manager','bd','operations','team_member') then$o$,
       $n$if public.app_role() is null then$n$)
    ) v(sig, old_txt, new_txt)
  loop
    if to_regprocedure(f.sig) is null then raise notice 'D22: % is not here — skipped', f.sig; continue; end if;
    d := pg_get_functiondef(to_regprocedure(f.sig));
    if position(f.new_txt in d) > 0 then continue; end if;                     -- already applied
    if position(f.old_txt in d) = 0 then raise exception 'D22: % does not carry the expected role check — stopped, nothing changed', f.sig; end if;
    n := replace(d, f.old_txt, f.new_txt);
    execute n;
  end loop;
end $d22$;
