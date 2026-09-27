-- tasks-to-achievements.sql (2026-09-27) — the owner's order of 26 Sep, part 3: Tasks → Achievements ready for real use.
-- Found by walking the flow as an employee (2026-09-27 review), all in the one trigger that turns a finished task into its
-- achievement (release 1's tasks_register_achievement, scripts/sql/phase3-r1-task-manager.sql):
--   1. "count it in the monthly report" ticked AFTER the task was already done registered nothing (only the moment a task
--      BECAME done counted) — now ticking it on a done task registers the achievement then;
--   2. unticking it on a done task left the achievement standing — now it is withdrawn, exactly as reopening does;
--   3. a later change of the task's title, kind of achievement, KPI, company or team never reached its achievement — now it
--      follows while the month is open (an issued month is frozen: the task edit is not blocked, the line stays as issued);
--   4. reopening (or unticking) a task whose achievement carries proof files failed with a raw foreign-key error — now it
--      says plainly that the achievement has proofs and stays counted;
--   5. a task finished on a date no reporting month covers registered NOTHING, silently — now it is refused, in words.
-- Same rights as before (security definer: the trigger must see rows the person cannot); same final/draft rule.
-- Rollback: scripts/sql/tasks-to-achievements.rollback.sql (release 1's function, as it was).

create or replace function public.tasks_register_achievement() returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare was_done boolean := tg_op='UPDATE' and old.status='done' and old.deleted_at is null;
        is_done  boolean := new.status='done' and new.deleted_at is null;
        was_in   boolean := tg_op='UPDATE' and coalesce(old.include_in_report, false);
        e record; pm uuid; locked boolean;
begin
  select * into e from report_entries where source='task' and source_id=new.id;
  -- register: the task became done while counted, or a done task was ticked to count
  if is_done and new.include_in_report and e.id is null and (not was_done or not was_in) then
    select id into pm from periods where kind='month' and (new.done_at at time zone 'Asia/Riyadh')::date between start_date and end_date;
    if pm is null then
      raise exception 'No reporting month covers % — the achievement for task % cannot be registered', (new.done_at at time zone 'Asia/Riyadh')::date, new.code; end if;
    insert into report_entries(period_id, department_id, member_id, section, category_id, title, entry_date, business_id,
      kpi_id, objective_id, source, source_id, status, created_by)
    values (pm, new.department_id, new.owner_id, 'achievement', new.report_category_id, new.title,
      (new.done_at at time zone 'Asia/Riyadh')::date, new.business_id, new.kpi_id,
      (select objective_id from kpi_definitions where id=new.kpi_id), 'task', new.id,
      case when can_manage_task(new) then 'final' else 'draft' end, new.owner_id);
  -- withdraw: reopened, or no longer counted
  elsif e.id is not null and ((was_done and not is_done) or (is_done and was_in and not new.include_in_report)) then
    if e.status = 'final' and not can_manage_task(new) then
      raise exception 'Task % is a final achievement — only its owner or whoever manages it can reopen it', new.code; end if;
    if exists (select 1 from evidence_files where entry_id = e.id) then
      raise exception 'Task % counts as an achievement with proof files attached — it stays counted; record a correction instead', new.code; end if;
    delete from report_entries where id = e.id;   -- blocked only once the month is issued (report_entries_guard)
  -- follow: the task's own words reach its achievement while the month is open
  elsif e.id is not null and is_done and new.include_in_report
        and (new.title, new.report_category_id, new.kpi_id, new.business_id, new.department_id)
            is distinct from (e.title, e.category_id, e.kpi_id, e.business_id, e.department_id) then
    select locked_at is not null into locked from periods where id = e.period_id;
    if not coalesce(locked, false) then
      update report_entries set title = new.title, category_id = new.report_category_id, kpi_id = new.kpi_id,
             objective_id = (select objective_id from kpi_definitions where id = new.kpi_id), business_id = new.business_id,
             department_id = new.department_id
       where id = e.id;
    end if;
  end if;
  return new;
end $$;
