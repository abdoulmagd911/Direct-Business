-- FIX-05 (Landing 5, F005): asking the same person a second question while the first is still open was refused with
-- the raw unique-index text ("Key (entity_table, entity_id, asked_to)=... already exists"), exposing internal ids.
-- The insert now catches that violation and raises `comment.already_asked` with the asked person's name as the
-- detail, so the toast reads "You already have an open question with {name}." Nothing else changes: the refusal
-- still saves nothing, and the unique index stays the guard (a race between two asks lands on the same refusal).
-- Forward-only: replaces work.comment_add from 20261107130000_core_generic_comments.sql whole.

create or replace function work.comment_add(p_entity text, p_id uuid, p_body text, p_asked_to uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := work.comment_record(p_entity, p_id);
  b text := pg_catalog.btrim(coalesce(p_body, ''));
  cid uuid;
  req uuid;
  p uuid;
  is_past boolean := false;
  t work.task;
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
  if p_asked_to is not null then
    if p_asked_to = me then
      raise exception using errcode = 'P0001', message = 'comment.ask_yourself';
    end if;
    if not work.person_ok(p_asked_to) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_asked_to::text;
    end if;
    if not authz.can_see_as(p_asked_to, e.table_name, p_id) then
      raise exception using errcode = 'P0001', message = 'comment.asked_cannot_see', detail = p_asked_to::text;
    end if;
  end if;
  req := audit.begin('ui', 'comment.added', pg_catalog.jsonb_build_object('entity', p_entity));
  begin
    insert into core.comment (entity_table, entity_id, body, seq, asked_to, question_open)
    values (e.table_name, p_id, b,
            coalesce((select pg_catalog.max(seq) from core.comment
                      where entity_table = e.table_name and entity_id = p_id), 0) + 1,
            p_asked_to, p_asked_to is not null)
    returning id into cid;
  exception when unique_violation then
    -- the only unique index this insert can hit is comment_one_open_question (one open question per person
    -- per record); a plain comment (no one asked) never reaches it, so any other violation is re-raised as-is
    if p_asked_to is null then
      raise;
    end if;
    raise exception using errcode = 'P0001', message = 'comment.already_asked',
      detail = (select coalesce(pr.display_name_en, q.nickname_en, q.full_name_en)
                from core.person q left join core.person_profile pr on pr.person_id = q.id
                where q.id = p_asked_to);
  end;
  -- the record's owners are told once each, never the author; a question is also put to the person asked; a comment
  -- on past work tells nobody (V491, kept for tasks — CMT-01)
  if e.table_name = 'work.task' then
    select * into t from work.task where id = p_id;
    is_past := work.task_is_past(t);
  end if;
  if not is_past then
    for p in select distinct o from core.comment_owners(e.table_name, p_id) o loop
      perform notify.push_assigned(p, 'commented', e.table_name, p_id,
        pg_catalog.jsonb_build_object('record', work.comment_record_label(e.table_name, p_id),
                                     'preview', pg_catalog.left(b, 120)));
    end loop;
    if p_asked_to is not null then
      perform notify.push_assigned(p_asked_to, 'asked', e.table_name, p_id,
        pg_catalog.jsonb_build_object('record', work.comment_record_label(e.table_name, p_id),
                                     'preview', pg_catalog.left(b, 120)));
    end if;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
end
$$;
