-- Rollback for phase3-r1-task-manager.sql (Phase 3 release 1). Puts the live database back as it was on
-- 2026-09-25 before release 1: drops every table, view and function it created, removes the Tasks page
-- from everyone's grid, and restores the four live objects it changed (access_pages, default_page_levels,
-- record_history_read, undo_change) plus promo_codes' two new columns and guard.
-- WARNING: dropping the tables deletes every task, project and achievement written since. Take a copy first.
begin;
drop view if exists company_card, achievement_trail, entry_proofs, kpi_pace, tasks_missing_weekly_update, company_open_work,
  kpi_scorecard, kpi_actuals, tasks_done_by_period, project_money, finance_credit, finance_as_of, finance_lines, period_compare cascade;
drop table if exists evidence_files, reports, work_finance_links, task_status_log, task_tags, tags, task_dependencies, task_files,
  task_comments, task_checklist, task_people, company_documents cascade;
alter table if exists tasks drop constraint if exists tasks_plan_fk, drop constraint if exists tasks_kpi_fk;
drop table if exists report_entries, kpi_targets, kpi_definitions, initiatives, objectives, tasks, projects, periods cascade;
alter table if exists departments drop constraint if exists departments_head_fk;
drop table if exists team_members, departments, report_categories, service_types, work_types, priorities, task_statuses, work_settings cascade;
drop trigger if exists promo_codes_guard on promo_codes;
alter table promo_codes drop column if exists purpose, drop column if exists services;
drop function if exists changes_to_my_tasks(int), next_work_number(text), my_member_id(), is_manager(), heads_department(uuid),
  seed_periods(int), open_visibility(), can_work(text), can_manage_task(tasks), can_work_on_task_id(uuid), can_edit_entry(report_entries),
  can_edit_entry_id(uuid), company_owner_member(uuid), can_assign_to(uuid), tasks_guard(), tasks_status_log(), tasks_register_achievement(),
  comments_guard(), company_documents_guard(), promo_codes_guard(), block_hard_delete(), stamp_uploader(), files_guard(), evidence_month_guard(),
  projects_guard(), projects_insert_guard(), tasks_delete_guard(), members_guard(), finance_link_guard(), report_entries_guard(),
  reports_guard(), reports_number(text), reports_issue(reports), reports_insert_guard(), work_today(), can_see_task(tasks),
  can_see_task_id(uuid), can_see_project(projects) cascade;
-- the Tasks page leaves everyone's grid (the guard trigger refuses unknown pages, so this comes first)
update app_users set page_access = page_access - 'tasks' where page_access ? 'tasks';
create or replace function public.access_pages() returns text[] language sql immutable set search_path to 'public' as $$
  select array['today','leads','clients','offers','documents','ops','reports','finance','settings',
               'events','airlines','vendors','sopsla','activity','archive',
               'projects','bookings','invoices','tickets','sync']
$$;
create or replace function public.default_page_levels(r public.user_role) returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end $$;
drop policy if exists record_history_read on public.record_history;
create policy record_history_read on public.record_history for select to authenticated using (
  case when table_name = any (array['finance_invoices','finance_transactions','finance_client_links']) then public.can_see_page('finance') else true end);
do $u$ declare d text; begin
  d := pg_get_functiondef('public.undo_change(bigint)'::regprocedure);
  d := replace(d, $x$
  elsif h.table_name in ('tasks','projects','task_people','task_checklist','task_comments','task_files','task_dependencies','task_tags') then
    pg := 'tasks';   -- R1: tasks$x$, '');
  d := replace(d, $x$ when 'tasks' then 'Tasks'$x$, '');
  execute d;
end $u$;
commit;
