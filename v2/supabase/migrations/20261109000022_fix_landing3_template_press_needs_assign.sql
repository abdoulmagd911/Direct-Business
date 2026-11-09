-- Landing 3 (P1b boundary, TPL-03): a template press that names another owner still needs
-- `tasks.assign` — the template's own documented rule ("a task for someone else needs tasks.assign",
-- 20261007085600 header). Cluster A's task_create door (20261109043200, approved) lets
-- `tasks.assign_own` name another owner at DIRECT creation (TSK-01); the press path is narrower by
-- design, because the offered task is the presser's. Copied from 20261007085600 exactly otherwise.
-- Forward-only (V103).
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
  -- P1b boundary (TPL-03): the template's own documented rule is "a task for someone else needs
  -- tasks.assign". Cluster A's task_create door lets `tasks.assign_own` name another owner at direct
  -- creation (TSK-01, approved) — but a template press makes the PRESSER's task, so a press that
  -- names someone else still needs Assign alone. Enforced here, before the occurrence is consumed,
  -- so the pre-existing TPL-03 expectation holds without touching the approved task_create door.
  if nullif(v ->> 'owner_id', '')::uuid is not null
     and nullif(v ->> 'owner_id', '')::uuid is distinct from me and not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  req := audit.begin('ui', 'task.created', pg_catalog.jsonb_build_object('template', t.title));
  insert into work.task_occurrence (template_id, occurs_on, partner_id) values (t.id, day, pid)
  on conflict do nothing returning id into occ;
  if occ is null then
    raise exception using errcode = 'P0001', message = 'template.applied_today';
  end if;
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
