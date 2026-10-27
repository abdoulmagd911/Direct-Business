-- Sabotage: a-comment-on-past-work-tells-the-team
-- Breaks: sql:CMT-01
-- Expect: a comment on past work tells nobody
-- A comment on past work tells the tasks people, as live work does.
create or replace function work.task_comment_add(p_task uuid, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_for_comments(p_task, true);
  b text := pg_catalog.btrim(coalesce(p_body, ''));
  cid uuid;
  req uuid;
  p uuid;
begin
  if b = '' then
    raise exception using errcode = 'P0001', message = 'task.comment_body_required';
  end if;
  if pg_catalog.length(b) > 4000 then
    raise exception using errcode = 'P0001', message = 'task.comment_too_long';
  end if;
  req := audit.begin('ui', 'task.commented', pg_catalog.jsonb_build_object('number', t.number));
  insert into work.task_comment (task_id, body) values (p_task, b) returning id into cid;
  -- the task's people are told, once each, never the author, and not about past work (V491)
  if true then
    for p in select distinct o from work.task_owners(p_task) o loop
      perform notify.push_assigned(p, 'task_commented', 'work.task', p_task,
                                   pg_catalog.jsonb_build_object('number', t.number));
    end loop;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
end
$$;
