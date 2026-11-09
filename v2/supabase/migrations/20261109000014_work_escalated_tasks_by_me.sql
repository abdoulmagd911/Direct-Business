-- Landing 3 (FIX-26 F006): the tasks I flagged as needing help. work.escalated_tasks answers the
-- tasks flagged to me; this is its mirror — the tasks I flagged, newest flag first — the Need-help part
-- of "Waiting on others" on My day. Only where I can still see the task. Forward-only (V103).
create function work.escalated_tasks_by_me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(work.task_row(t, me) order by t.escalated_at desc nulls last, t.number)
    from work.task t
    where t.escalated and t.escalated_by = me and t.deleted_at is null
      and work.row_level('work.task', t.id, me) >= 'view'), '[]'::jsonb);
end
$$;
comment on function work.escalated_tasks_by_me() is
  'Landing 3: the tasks I flagged as needing help, newest flag first.';
create function api.escalated_tasks_by_me() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.escalated_tasks_by_me() $$;
comment on function api.escalated_tasks_by_me() is
  'Landing 3: the tasks I flagged as needing help.';
revoke all on function work.escalated_tasks_by_me(), api.escalated_tasks_by_me() from public;
grant execute on function work.escalated_tasks_by_me(), api.escalated_tasks_by_me() to authenticated;
