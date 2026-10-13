-- Sabotage: an-offered-template-is-made-twice-a-day
-- Breaks: sql:TPL-03
-- Expect: once a day for an organisation
-- Pressing an offered template twice makes two tasks.
create or replace function work.task_from_template(p_template uuid, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  t work.task_template;
  day date := coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today());
  pid uuid := nullif(v ->> 'partner_id', '')::uuid;
  req uuid;
  a jsonb;
  occ uuid;
begin
  select * into t from work.task_template where id = p_template and active and deleted_at is null;
  if t.id is null or t.offered_on is null then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.task_template';
  end if;
  req := audit.begin('ui', 'task.created', pg_catalog.jsonb_build_object('template', t.title));
  insert into work.task_occurrence (template_id, occurs_on, partner_id) values (t.id, day, pid)
  on conflict do nothing returning id into occ;
  a := work.task_create(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
         'title', t.title, 'notes', t.notes, 'priority', t.priority_id::text, 'type', t.type_id::text,
         'team_id', t.team_id::text, 'work_type', case when pid is null then 'internal' else 'client' end)) || v);
  update work.task_occurrence set task_id = (a ->> 'id')::uuid where id = occ;
  update work.task set origin = 'template' where id = (a ->> 'id')::uuid;
  perform work.template_checklist_add(t, (a ->> 'id')::uuid, day);
  if t.attach_previous then
    perform work.template_attach_previous(t, pid, (a ->> 'id')::uuid);
  end if;
  perform audit.end();
  return a || pg_catalog.jsonb_build_object('request_id', req, 'template_id', t.id);
end
$$;
