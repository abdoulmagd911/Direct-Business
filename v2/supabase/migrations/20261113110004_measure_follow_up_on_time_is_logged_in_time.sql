-- Owner 13 Nov (A-tasks): work.action_items_on_time judged a follow-up (action item) on time when its done day was on or
-- before its due day — and the done day is whatever the tick said (api.action_item_done's p_on, or a task closed as
-- Done on a back-dated day closing its items with it). A follow-up ticked a month late but dated back counted as on
-- time, while a task dated back the same way did not (work.tasks_on_time asks measure.on_record since V400). A
-- follow-up is now on time only when its done day is on or before its due day AND the tick was logged in time:
-- measure.on_record with the moment the done day was written (the item's latest change that set it — audit.change,
-- read through its row index), else when the item was logged. Backfilled work stays on record, as for tasks; before
-- go-live nothing is "logged late" (core.logged_late), so nothing changes there.
-- Copied from 20261007085400_work_measures.sql but for the marked judgement. Forward-only: replaced whole.
create or replace function measure.work_action_items_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                                   p_from date, p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'work.action_item'::text, a.id, coalesce(a.owner_id, t.owner_id), a.due_on,
         -- done on or before its day, and written down in time (a back-dated tick counts only when logged in time)
         coalesce(a.done_on <= a.due_on
                  and measure.on_record(a.done_on, coalesce(d.at, a.logged_at), t.origin = 'backfill'), false)
  from work.action_item a
  join work.task t on t.id = a.task_id
  join work.task_status s on s.id = t.status_id
  left join lateral (
    select c.at from audit.change c
    where c.table_name = 'work.action_item' and c.row_id = a.id and c.after ->> 'done_on' is not null
    order by c.id desc limit 1) d on a.done_on is not null
  where a.deleted_at is null and t.deleted_at is null and s.meaning <> 'cancelled'
    and a.due_on between p_from and least(p_to, core.riyadh_today() - 1)
    and measure.in_scope(p_scope_kind, p_scope_id, coalesce(a.owner_id, t.owner_id), t.team_id, t.department_id,
                         t.partner_id)
  order by a.due_on, a.id;
end
$$;
