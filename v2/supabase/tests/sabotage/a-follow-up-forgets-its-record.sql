-- Sabotage: a-follow-up-forgets-its-record
-- Breaks: sql:FUP-01
-- Expect: about the client
-- A follow-up is made but not tied to its record, so neither the Today block nor the record can show it (V632 Stage 2).
create or replace function work.follow_up(p_entity text, p_id uuid, p_due_on date, p_assignee uuid default null,
                               p_title text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  tbl text := case p_entity when 'partner' then 'partner.partner' when 'task' then 'work.task'
                            when 'invoice' then 'finance.invoice' end;
  who uuid := coalesce(p_assignee, me);
  about jsonb;
  pid uuid;
  prj uuid;
  v jsonb;
  res jsonb;
begin
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'follow_up.entity_invalid', detail = p_entity;
  end if;
  if p_id is null or not authz.can_see_as(me, tbl, p_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = tbl;
  end if;
  if p_due_on is null then
    raise exception using errcode = 'P0001', message = 'follow_up.due_required';
  end if;
  if p_due_on < core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'follow_up.due_passed';
  end if;
  if who <> me and not authz.can_see_as(who, tbl, p_id) then
    raise exception using errcode = 'P0001', message = 'follow_up.assignee_cannot_see';
  end if;
  about := work.about_of(tbl, p_id, me);
  if tbl = 'partner.partner' then
    pid := p_id;
  elsif tbl = 'work.task' then
    select t.partner_id, t.project_id into pid, prj from work.task t where t.id = p_id;
  end if;
  v := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
         'title', pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_title), ''), 'Follow-up'), 300),
         'type', 'follow_up', 'due_on', p_due_on, 'owner_id', who, 'partner_id', pid, 'project_id', prj,
         'work_type', case when pid is null and prj is null then 'internal' else 'client' end));
  perform audit.begin('ui', 'task.follow_up_set', pg_catalog.jsonb_build_object('entity', p_entity));
  res := work.task_create(v);
  perform audit.end();
  return res || pg_catalog.jsonb_build_object('about', about);
end
$$;
