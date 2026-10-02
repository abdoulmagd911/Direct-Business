-- Sabotage: blocked-forgets-its-reason
-- Breaks: sql:TSK-04
-- Expect: the reason shows
-- Blocking keeps no reason on the task.
create or replace function work.task_status_set(p_id uuid, p_status text, p_happened_on date default null, p_reason text default null,
                                     p_close_items boolean default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  s work.task_status := work.status_of(p_status);
  cur work.task_status;
  day date := coalesce(p_happened_on, core.riyadh_today());
  blocked boolean := nullif(pg_catalog.btrim(p_reason), '') is not null;
  open_items int;
  req uuid;
  what text;
begin
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = p_status;
  end if;
  select * into cur from work.task_status where id = t.status_id;
  if blocked and s.meaning <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'task.only_in_progress_blocks';
  end if;
  if day < t.happened_on then
    raise exception using errcode = 'P0001', message = 'task.status_before_raised';
  end if;
  select pg_catalog.count(*)::int into open_items from work.action_item a
  where a.task_id = p_id and a.deleted_at is null and a.done_on is null;
  if s.meaning = 'done' and open_items > 0 and not coalesce(p_close_items, false) then
    raise exception using errcode = 'P0001', message = 'task.open_action_items', detail = open_items::text;
  end if;
  if s.id = cur.id and blocked = (t.blocked_reason is not null) and not blocked then
    raise exception using errcode = 'P0001', message = 'task.status_unchanged';
  end if;
  req := audit.begin('ui', 'task.status_set', pg_catalog.jsonb_build_object('number', t.number, 'status', s.key,
                                                                             'blocked', blocked));
  perform audit.happened(p_happened_on);
  perform work.quiet_if_past(array[p_id]);
  begin
    insert into work.task_status_change (task_id, from_status_id, to_status_id, blocked, reason, happened_on)
    values (p_id, t.status_id, s.id, blocked, nullif(pg_catalog.btrim(p_reason), ''), day);
    if s.meaning = 'done' and open_items > 0 then
      update work.action_item set done_on = greatest(day, happened_on), done_by = me
      where task_id = p_id and deleted_at is null and done_on is null;
    end if;
    update work.task set
      status_id = s.id,
      blocked_reason = null,
      blocked_on = null,
      closed_at = case when s.meaning in ('done', 'cancelled') then core.clock() end,
      closed_by = case when s.meaning in ('done', 'cancelled') then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'status', s.key, 'meaning', s.meaning,
                                       'blocked', blocked, 'items_closed', case when s.meaning = 'done' then open_items else 0 end);
end
$$;
