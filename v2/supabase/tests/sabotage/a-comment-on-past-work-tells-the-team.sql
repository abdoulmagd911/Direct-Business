-- Sabotage: a-comment-on-past-work-tells-the-team
-- Breaks: sql:CMT-01
-- Expect: a comment on past work tells nobody
-- A comment on past work tells the tasks people, as live work does.
create or replace function work.comment_add(p_entity text, p_id uuid, p_body text, p_asked_to uuid default null)
  returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := work.comment_record(p_entity, p_id);
  b text := pg_catalog.btrim(coalesce(p_body, ''));
  cid uuid;
  req uuid;
  p uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not work.comment_may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if b = '' then
    raise exception using errcode = 'P0001', message = 'comment.body_required';
  end if;
  if pg_catalog.length(b) > 4000 then
    raise exception using errcode = 'P0001', message = 'comment.too_long';
  end if;
  req := audit.begin('ui', 'comment.added', pg_catalog.jsonb_build_object('entity', p_entity));
  insert into core.comment (entity_table, entity_id, body, seq, asked_to, question_open)
  values (e.table_name, p_id, b,
          coalesce((select pg_catalog.max(seq) from core.comment
                    where entity_table = e.table_name and entity_id = p_id), 0) + 1,
          p_asked_to, p_asked_to is not null)
  returning id into cid;
  -- past work tells the task's people too, as live work does
  if true then
    for p in select distinct o from core.comment_owners(e.table_name, p_id) o loop
      perform notify.push_assigned(p, 'commented', e.table_name, p_id,
        pg_catalog.jsonb_build_object('record', work.comment_record_label(e.table_name, p_id),
                                     'preview', pg_catalog.left(b, 120)));
    end loop;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
end
$$;
