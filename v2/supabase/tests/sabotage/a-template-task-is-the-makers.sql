-- Sabotage: a-template-task-is-the-makers
-- Breaks: sql:TPL-01
-- Expect: attributed to the template's maker
-- A generated task is the system's, not the template maker's (TECH-SPEC §3.7).
create or replace function work.template_request(t work.task_template) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid;
begin
  if coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0) > 0 then
    raise exception using errcode = 'P0001', message = 'audit.nested_request';
  end if;
  insert into audit.request (actor_id, kind, label_key, label_args)
  values (core.system_person_id(), 'job', 'task.generated', pg_catalog.jsonb_build_object('template', t.title))
  returning id into r;
  perform pg_catalog.set_config('app.request_id', r::text, true);
  perform pg_catalog.set_config('app.request_depth', '1', true);
  return r;
end
$$;
