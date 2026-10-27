-- Sabotage: an-admin-edits-any-comment
-- Breaks: sql:CMT-01
-- Expect: an admin does not edit the comment of another person
-- An admin may edit another persons comment.
create or replace function work.task_comment_edit(p_id uuid, p_body text, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c work.task_comment;
  b text := pg_catalog.btrim(coalesce(p_body, ''));
  req uuid;
begin
  select * into c from work.task_comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform work.task_for_comments(c.task_id, false);
  if c.created_by <> me and not authz.is_admin() then
    raise exception using errcode = '42501', message = 'task.comment_not_yours';
  end if;
  if b = '' then
    raise exception using errcode = 'P0001', message = 'task.comment_body_required';
  end if;
  if pg_catalog.length(b) > 4000 then
    raise exception using errcode = 'P0001', message = 'task.comment_too_long';
  end if;
  perform core.check_version('work.task_comment', p_id, p_version,
    case when b is distinct from c.body then array['body'] else array[]::text[] end);
  req := audit.begin('ui', 'task.comment_edited',
                     pg_catalog.jsonb_build_object('number', (select t.number from work.task t where t.id = c.task_id)));
  perform audit.write_fields('work.task_comment', p_id,
                             pg_catalog.jsonb_build_object('body', b, 'edited_at', core.clock()));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id,
    'version', (select x.version from work.task_comment x where x.id = p_id), 'request_id', req);
end
$$;
