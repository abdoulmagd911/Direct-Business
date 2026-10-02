-- Sabotage: a-helper-ticks-any-item
-- Breaks: sql:TSK-03
-- Expect: a helper does not tick an item that is not theirs
-- Anyone with Own ticks any item on any task.
create or replace function work.action_item_done(p_id uuid, p_done boolean, p_on date default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a work.action_item;
  t work.task;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from work.action_item where id = p_id and deleted_at is null;
  if a.id is null or work.row_level('work.action_item', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into t from work.task where id = a.task_id;
  if work.row_level('work.action_item', p_id, me) < 'own' then
    raise exception using errcode = '42501', message = 'action_item.not_yours';
  end if;
  if p_done is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  req := audit.begin('ui', case when p_done then 'action_item.done' else 'action_item.reopened' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  perform audit.happened(p_on);
  perform work.quiet_if_past(array[t.id]);
  begin
    update work.action_item set done_on = case when p_done then coalesce(p_on, core.riyadh_today()) end,
                                done_by = case when p_done then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;
