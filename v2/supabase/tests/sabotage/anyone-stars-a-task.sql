-- Sabotage: anyone-stars-a-task
-- Breaks: sql:STAR-01
-- Expect: someone who may not change the task cannot star it
-- V661 undone: anyone signed in stars any task, whether or not they may change it.
create or replace function work.task_star(p_id uuid, p_starred boolean) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := (select x from work.task x where x.id = p_id);
  req uuid;
begin
  if p_starred is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  if t.starred = p_starred then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null, 'starred', t.starred, 'version', t.version);
  end if;
  req := audit.begin('ui', case when p_starred then 'task.starred' else 'task.unstarred' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  update work.task set starred = p_starred where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'starred', p_starred,
                                       'version', (select x.version from work.task x where x.id = p_id));
end
$$;
