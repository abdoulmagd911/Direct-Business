-- Landing 33 (B1, B2) — a comment can be THE DECISION, can link to the records it is about, and can mention people.
--
--   * One comment per record may be marked as the decision. The screen pins it on top, and marking
--     another one moves the mark. Whoever may comment on the record may mark or unmark; every mark is logged.
--   * A comment may carry up to ten links to a partner, a project, an invoice or a discount code. The writer must be
--     able to see each one; a reader who cannot see a linked record is told only that a record is linked.
--   * A comment may mention people. Each is told ("mentioned"). On a task a mention is a hand to help: the person
--     becomes a HELPER of the task (it shows under Helping) — never its Responsible. Only a hand-over changes that.
--     A person who cannot see the record is refused, by name.
--
-- Forward-only. No pushed migration is edited: comment_add gains two optional arguments, so the old four-argument
-- functions are dropped and made again (every caller that passes four arguments keeps working).

alter table core.comment
  add column is_decision boolean not null default false,
  add column decided_by uuid references core.person (id),
  add column decided_at timestamptz,
  add column link_kinds text[] not null default '{}',
  add column link_ids uuid[] not null default '{}',
  add column mentions uuid[] not null default '{}',
  add constraint comment_decision_has_who check (is_decision = (decided_by is not null) and is_decision = (decided_at is not null)),
  add constraint comment_links_pair check (pg_catalog.cardinality(link_kinds) = pg_catalog.cardinality(link_ids)
    and pg_catalog.cardinality(link_ids) <= 10
    and link_kinds <@ array['partner', 'project', 'invoice', 'code']),
  add constraint comment_mentions_few check (pg_catalog.cardinality(mentions) <= 20);

create unique index comment_one_decision on core.comment (entity_table, entity_id)
  where is_decision and deleted_at is null;
create index comment_decided_by_fk on core.comment (decided_by);

-- The links of one comment as the reader may see them: kind, id and the record's own name; a record the reader may
-- not see answers {"kind": …, "hidden": true} and nothing else.
create function work.comment_links(p_kinds text[], p_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  n int;
  k text;
  i uuid;
  one jsonb;
  res jsonb := '[]'::jsonb;
begin
  if me is null then
    return res;
  end if;
  for n in 1 .. coalesce(pg_catalog.cardinality(p_ids), 0) loop
    k := p_kinds[n];
    i := p_ids[n];
    one := null;
    if k = 'partner' and partner.level_of(me, i) >= 'view' then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', p.number, 'label', p.trade_name_en,
                                           'label_ar', p.trade_name_ar)
      into one from partner.partner p where p.id = i and p.deleted_at is null;
    elsif k = 'project' and authz.can_see_as(me, 'work.project', i) then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', p.number, 'label', p.name, 'label_ar', null)
      into one from work.project p where p.id = i and p.deleted_at is null;
    elsif k = 'invoice' and authz.level_of(me, 'finance') >= 'view' then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', v.ref, 'label', v.ref, 'label_ar', null)
      into one from finance.invoice v
      where v.id = i and v.deleted_at is null and (finance.exclusion_of(v.id)).mode is distinct from 'hide';
    elsif k = 'code' and authz.level_of(me, 'codes') >= 'view' then
      select pg_catalog.jsonb_build_object('kind', k, 'id', i, 'number', d.value_raw, 'label', d.value_raw,
                                           'label_ar', null)
      into one from partner.identifier d where d.id = i and d.kind = 'discount_code' and d.deleted_at is null;
    end if;
    res := res || pg_catalog.jsonb_build_array(coalesce(one, pg_catalog.jsonb_build_object('kind', k, 'hidden', true)));
  end loop;
  return res;
end
$$;

-- What a writer hands in ([{"kind": …, "id": …}]) becomes the stored pair of lists: known kinds only, each a record
-- the writer sees, no repeats.
create function work.comment_links_checked(p_links jsonb, out kinds text[], out ids uuid[])
language plpgsql stable security definer set search_path = '' as $$
declare
  l jsonb;
  seen jsonb;
  k text;
  i uuid;
  n int;
  dup boolean;
begin
  kinds := '{}';
  ids := '{}';
  if p_links is null or pg_catalog.jsonb_typeof(p_links) <> 'array' then
    return;
  end if;
  if pg_catalog.jsonb_array_length(p_links) > 10 then
    raise exception using errcode = 'P0001', message = 'comment.too_many_links';
  end if;
  for l in select * from pg_catalog.jsonb_array_elements(p_links) loop
    if coalesce(l ->> 'kind', '') not in ('partner', 'project', 'invoice', 'code')
       or coalesce(l ->> 'id', '') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception using errcode = 'P0001', message = 'comment.link_unknown';
    end if;
    k := l ->> 'kind';
    i := (l ->> 'id')::uuid;
    seen := work.comment_links(array[k], array[i]) -> 0;
    if coalesce((seen ->> 'hidden')::boolean, false) then
      raise exception using errcode = 'P0001', message = 'comment.link_cannot_see', detail = k;
    end if;
    dup := false;
    for n in 1 .. pg_catalog.cardinality(ids) loop
      dup := dup or (kinds[n] = k and ids[n] = i);
    end loop;
    if not dup then
      kinds := kinds || k;
      ids := ids || i;
    end if;
  end loop;
end
$$;

drop function api.comment_add(text, uuid, text, uuid);
drop function work.comment_add(text, uuid, text, uuid);

create function work.comment_add(p_entity text, p_id uuid, p_body text, p_asked_to uuid default null,
                                 p_links jsonb default null, p_mentions uuid[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  e core.entity := work.comment_record(p_entity, p_id);
  b text := pg_catalog.btrim(coalesce(p_body, ''));
  cid uuid;
  req uuid;
  p uuid;
  is_past boolean := false;
  t work.task;
  lk text[];
  li uuid[];
  named uuid[];
  helpers int := 0;
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
  select c.kinds, c.ids into lk, li from work.comment_links_checked(p_links) c;
  -- the people named: each once, never the writer; each must be at work and able to see the record
  select coalesce(pg_catalog.array_agg(distinct m), '{}') into named
  from pg_catalog.unnest(coalesce(p_mentions, '{}')) m where m is not null and m <> me;
  if pg_catalog.cardinality(named) > 20 then
    raise exception using errcode = 'P0001', message = 'comment.too_many_mentions';
  end if;
  foreach p in array named loop
    if not work.person_ok(p) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p::text;
    end if;
    if not authz.can_see_as(p, e.table_name, p_id) then
      raise exception using errcode = 'P0001', message = 'comment.mention_cannot_see',
        detail = (select coalesce(pr.display_name_en, q.nickname_en, q.full_name_en)
                  from core.person q left join core.person_profile pr on pr.person_id = q.id where q.id = p);
    end if;
  end loop;
  req := audit.begin('ui', 'comment.added', pg_catalog.jsonb_build_object('entity', p_entity));
  begin
    insert into core.comment (entity_table, entity_id, body, seq, asked_to, question_open, link_kinds, link_ids, mentions)
    values (e.table_name, p_id, b,
            coalesce((select pg_catalog.max(seq) from core.comment
                      where entity_table = e.table_name and entity_id = p_id), 0) + 1,
            p_asked_to, p_asked_to is not null, lk, li, named)
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
    -- B2: a mention on a task hands the task to the person's Helping list. The Responsible is never changed here.
    foreach p in array named loop
      if t.owner_id is distinct from p
         and not exists (select 1 from work.task_helper h
                         where h.task_id = p_id and h.person_id = p and h.deleted_at is null) then
        insert into work.task_helper (task_id, person_id) values (p_id, p);
        helpers := helpers + 1;
      end if;
    end loop;
  end if;
  if not is_past then
    for p in select distinct o from core.comment_owners(e.table_name, p_id) o where not (o = any (named)) loop
      perform notify.push_assigned(p, 'commented', e.table_name, p_id,
        pg_catalog.jsonb_build_object('record', work.comment_record_label(e.table_name, p_id),
                                     'preview', pg_catalog.left(b, 120)));
    end loop;
    if p_asked_to is not null then
      perform notify.push_assigned(p_asked_to, 'asked', e.table_name, p_id,
        pg_catalog.jsonb_build_object('record', work.comment_record_label(e.table_name, p_id),
                                     'preview', pg_catalog.left(b, 120)));
    end if;
    foreach p in array named loop
      perform notify.push_assigned(p, 'mentioned', e.table_name, p_id,
        pg_catalog.jsonb_build_object('record', work.comment_record_label(e.table_name, p_id),
                                     'preview', pg_catalog.left(b, 120), 'comment_id', cid));
    end loop;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req, 'helpers_added', helpers);
end
$$;

create function api.comment_add(p_entity text, p_id uuid, p_body text, p_asked_to uuid default null,
                                p_links jsonb default null, p_mentions uuid[] default null) returns jsonb
language sql security invoker set search_path = '' as
$$ select work.comment_add(p_entity, p_id, p_body, p_asked_to, p_links, p_mentions) $$;

-- Mark or unmark the decision. Marking moves the mark off any other comment of the same record.
create function work.comment_decide(p_id uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  c core.comment;
  e core.entity;
  req uuid;
  on_ boolean := coalesce(p_on, true);
begin
  select * into c from core.comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  e := work.comment_record(
    (select k.key from core.entity k where k.table_name = c.entity_table and k.active), c.entity_id);
  if not work.comment_may_write(e.table_name, c.entity_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if c.is_decision = on_ then
    raise exception using errcode = 'P0001', message = 'comment.decision_unchanged';
  end if;
  req := audit.begin('ui', case when on_ then 'comment.decision_marked' else 'comment.decision_unmarked' end,
                     pg_catalog.jsonb_build_object('entity', e.key));
  if on_ then
    update core.comment set is_decision = false, decided_by = null, decided_at = null
    where entity_table = c.entity_table and entity_id = c.entity_id and is_decision and deleted_at is null;
    update core.comment set is_decision = true, decided_by = me, decided_at = core.clock() where id = p_id;
  else
    update core.comment set is_decision = false, decided_by = null, decided_at = null where id = p_id;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'is_decision', on_, 'request_id', req);
end
$$;

create function api.comment_decide(p_id uuid, p_on boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select work.comment_decide(p_id, p_on) $$;

-- The read: every comment says whether it is the decision, who marked it and when, its links as the reader may see
-- them, and the people it mentions. The order stays oldest first; the screen pins the decision on top.
create or replace function work.comments(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  e core.entity := work.comment_record(p_entity, p_id);
  may boolean := work.comment_may_write(e.table_name, p_id);
begin
  return pg_catalog.jsonb_build_object(
    'read_at', core.clock(),
    'can_write', may,
    'can_decide', may,
    'comments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', c.id, 'author_id', c.created_by,
        'author_name', coalesce(pr.display_name_en, a.nickname_en, a.full_name_en),
        'author_name_ar', coalesce(pr.display_name_ar, a.nickname_ar, a.full_name_ar),
        'body', c.body, 'created_at', c.created_at, 'edited_at', c.edited_at,
        'edited', c.edited_at is not null, 'version', c.version,
        'mine', c.created_by = me,
        'can_edit', c.created_by = me and may,
        'can_remove', c.created_by = me or authz.is_admin(),
        'asked_to', c.asked_to,
        'asked_to_name', coalesce(qpr.display_name_en, q.nickname_en, q.full_name_en),
        'asked_to_name_ar', coalesce(qpr.display_name_ar, q.nickname_ar, q.full_name_ar),
        'question_open', c.question_open,
        'answer', c.answer, 'answered_at', c.answered_at, 'answered_by', c.answered_by,
        'answered_by_name', coalesce(apr.display_name_en, an.nickname_en, an.full_name_en),
        'answered_by_name_ar', coalesce(apr.display_name_ar, an.nickname_ar, an.full_name_ar),
        'is_decision', c.is_decision, 'decided_at', c.decided_at, 'decided_by', c.decided_by,
        'decided_by_name', coalesce(dpr.display_name_en, dn.nickname_en, dn.full_name_en),
        'decided_by_name_ar', coalesce(dpr.display_name_ar, dn.nickname_ar, dn.full_name_ar),
        'links', work.comment_links(c.link_kinds, c.link_ids),
        'mentions', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                   'id', m.id,
                   'name', coalesce(mpr.display_name_en, m.nickname_en, m.full_name_en),
                   'name_ar', coalesce(mpr.display_name_ar, m.nickname_ar, m.full_name_ar))
                   order by pg_catalog.lower(m.full_name_en), m.id)
          from core.person m left join core.person_profile mpr on mpr.person_id = m.id
          where m.id = any (c.mentions)), '[]'::jsonb))
        order by c.created_at, c.seq)
      from core.comment c
      left join core.person a on a.id = c.created_by
      left join core.person_profile pr on pr.person_id = c.created_by
      left join core.person q on q.id = c.asked_to
      left join core.person_profile qpr on qpr.person_id = c.asked_to
      left join core.person an on an.id = c.answered_by
      left join core.person_profile apr on apr.person_id = c.answered_by
      left join core.person dn on dn.id = c.decided_by
      left join core.person_profile dpr on dpr.person_id = c.decided_by
      where c.entity_table = e.table_name and c.entity_id = p_id and c.deleted_at is null), '[]'::jsonb));
end
$$;

revoke all on function work.comment_links(text[], uuid[]), work.comment_links_checked(jsonb),
  work.comment_add(text, uuid, text, uuid, jsonb, uuid[]), api.comment_add(text, uuid, text, uuid, jsonb, uuid[]),
  work.comment_decide(uuid, boolean), api.comment_decide(uuid, boolean) from public;
grant execute on function work.comment_add(text, uuid, text, uuid, jsonb, uuid[]), work.comment_decide(uuid, boolean)
  to authenticated;
grant execute on function api.comment_add(text, uuid, text, uuid, jsonb, uuid[]), api.comment_decide(uuid, boolean)
  to authenticated;
