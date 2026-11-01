-- A cancelled task closes with its why recorded, exactly as a blocked task does.
-- Before this, work.task_status_set refused any reason on a move that was not
-- In progress (task.only_in_progress_blocks), so asking for a reason on Cancelled
-- in the UI alone would have been refused by the database. This keeps the blocked
-- flow untouched and adds a separate cancelled_reason, rather than reusing
-- blocked_reason: reusing it would make a cancelled task read as blocked
-- (work.task_flags.blocked is blocked_reason is not null).
alter table work.task
  add column cancelled_reason text
    check (cancelled_reason is null or (pg_catalog.btrim(cancelled_reason) <> ''
                                            and pg_catalog.length(cancelled_reason) <= 500));

-- work.task_status_set, with exactly the cancelled-reason change: a reason is
-- accepted on In progress (blocked, as before) and on Cancelled (new); any other
-- move with a reason is still refused with the existing message. The status
-- change row is marked blocked only for a real block, never for a cancellation,
-- and reopening a task clears its cancelled reason, as it clears a block reason.
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
  is_block boolean := blocked and s.meaning = 'in_progress';
  is_cancel boolean := blocked and s.meaning = 'cancelled';
  open_items int;
  req uuid;
  what text;
begin
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = p_status;
  end if;
  select * into cur from work.task_status where id = t.status_id;
  if blocked and not (is_block or is_cancel) then
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
                                                                             'blocked', is_block));
  perform audit.happened(p_happened_on);
  perform work.quiet_if_past(array[p_id]);
  begin
    insert into work.task_status_change (task_id, from_status_id, to_status_id, blocked, reason, happened_on)
    values (p_id, t.status_id, s.id, is_block, nullif(pg_catalog.btrim(p_reason), ''), day);
    if s.meaning = 'done' and open_items > 0 then
      update work.action_item set done_on = greatest(day, happened_on), done_by = me
      where task_id = p_id and deleted_at is null and done_on is null;
    end if;
    update work.task set
      status_id = s.id,
      blocked_reason = case when is_block then pg_catalog.btrim(p_reason) end,
      blocked_on = case when is_block then day end,
      cancelled_reason = case when is_cancel then pg_catalog.btrim(p_reason) end,
      closed_at = case when s.meaning in ('done', 'cancelled') then core.clock() end,
      closed_by = case when s.meaning in ('done', 'cancelled') then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'status', s.key, 'meaning', s.meaning,
                                       'blocked', is_block, 'items_closed', case when s.meaning = 'done' then open_items else 0 end);
end
$$;

-- work.task_row, with exactly one field added: the cancelled reason, next to
-- the blocked reason, so list rows, board cards and the record read it.
create or replace function work.task_row(t work.task, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', t.id, 'number', t.number, 'title', t.title, 'owner_id', t.owner_id, 'team_id', t.team_id,
    'priority', pr.key, 'priority_en', pr.name_en, 'priority_ar', pr.name_ar, 'executive_directive', pr.meaning is not null,
    'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'meaning', s.meaning,
    'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar, 'work_type', t.work_type,
    'start_on', t.start_on, 'due_on', t.due_on, 'partner_id', t.partner_id, 'project_id', t.project_id,
    'origin', t.origin, 'happened_on', t.happened_on, 'logged_at', t.logged_at, 'closed_at', t.closed_at,
    'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'cancelled_reason', t.cancelled_reason, 'version', t.version,
    'can_edit', work.can_edit_task(p_reader, t),
    'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                          where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
    'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                         from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
  ) || work.task_flags(t)
  from work.task_status s
  left join work.priority pr on pr.id = t.priority_id
  left join work.task_type ty on ty.id = t.type_id
  where s.id = t.status_id
$$;
