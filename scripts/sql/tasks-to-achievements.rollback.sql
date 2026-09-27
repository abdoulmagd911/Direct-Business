-- tasks-to-achievements.rollback.sql — release 1's tasks_register_achievement, as it was (scripts/sql/phase3-r1-task-manager.sql).
create or replace function public.tasks_register_achievement() returns trigger language plpgsql security definer set search_path to public as $$
declare was_done boolean := tg_op='UPDATE' and old.status='done' and old.deleted_at is null;
        is_done boolean := new.status='done' and new.deleted_at is null; e record;
begin
  select * into e from report_entries where source='task' and source_id=new.id;
  if is_done and not was_done and new.include_in_report and e.id is null then
    insert into report_entries(period_id, department_id, member_id, section, category_id, title, entry_date, business_id,
      kpi_id, objective_id, source, source_id, status, created_by)
    select pm.id, new.department_id, new.owner_id, 'achievement', new.report_category_id, new.title,
      (new.done_at at time zone 'Asia/Riyadh')::date, new.business_id, new.kpi_id,
      (select objective_id from kpi_definitions where id=new.kpi_id), 'task', new.id, case when can_manage_task(new) then 'final' else 'draft' end, new.owner_id
    from periods pm where pm.kind='month' and (new.done_at at time zone 'Asia/Riyadh')::date between pm.start_date and pm.end_date;
  elsif was_done and not is_done and e.id is not null then
    if e.status = 'final' and not can_manage_task(new) then
      raise exception 'Task % is a final achievement — only its owner or whoever manages it can reopen it', new.code; end if;
    delete from report_entries where id = e.id;   -- reopened: its achievement is withdrawn (blocked only once the month is issued)
  end if;
  return new;
end $$;
