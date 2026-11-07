-- Phase 2 (lifecycle gaps) — generic comments + Discussion with Ask (2.1).
--
-- PRE-STEP (recorded outcome): achievement visibility IS wider than owner / participants / direct manager / admins —
-- the whole department team sees every achievement of its departments (V96: perf.sees_department, read through
-- perf.row_level, which api.achievement's read rule uses). The generic read rule matches it exactly:
-- core.can_see_record delegates to authz.can_see_as, which reads authz.record_level, which is perf.row_level for
-- achievements — so a comment on an achievement is visible to exactly the people who can see the achievement, and a
-- comment never widens its record. For writing, achievements keep their per-type writer list: core.may_write on the
-- record (Full on KPIs, or Own on KPIs and one of the achievement's own people — owner, creator, participant). A
-- department member who merely sees an achievement cannot comment on it.
--
-- The write rule, by record type (work.comment_may_write): a task keeps its rule (CMT-01 — whoever may change it or
-- helps on it, work.can_comment); an achievement keeps the per-type list above; an author-only private note takes no
-- comment from anyone but its author; every other record takes a comment from whoever can see it.
--
-- One table, core.comment, for every record in scope (task, achievement, note/idea, partner): a comment is a question
-- when asked_to is set, and only an explicit reply by the asked person closes it (work.comment_answer); a casual
-- comment by the asked person does not. A closed question cannot be re-answered, only re-asked as a new question.
-- A new comment tells the record's owners once each (kind commented, via core.comment_owners, which dispatches to the
-- parent record's owners function from the registry), never the author; a question is also put to the person asked
-- (kind asked). A comment on past work tells nobody (V491, kept for tasks — CMT-01). The bell groups commented items
-- one per record per day (NotificationsPanel); tapping one lands on the record.
--
-- CUTOVER (2.1/2.3): the rows of work.task_comment move here — id, body, seq, created_by, edited_at, version and the
-- soft-delete state preserved — and the old table is left empty; TaskComments reads core.comment from this build on.
-- The cutover INSERT runs before audit.track, so audit.stamp() does not overwrite the preserved created_at/created_by.
-- Forward-only (V103): nothing already on v2/main is edited here.

-- ================================================================ the table
create table core.comment (
  id uuid primary key default gen_random_uuid(),
  entity_table text not null,
  entity_id uuid not null,
  body text not null check (pg_catalog.btrim(body) <> '' and pg_catalog.length(body) <= 4000),
  -- the order written on this record, when two comments carry the same instant (one request)
  seq int not null,
  edited_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  -- a question: who is asked, and the answer that closed it (null while it is open)
  asked_to uuid references core.person (id),
  question_open boolean not null default false,
  answer text check (answer is null or (pg_catalog.btrim(answer) <> '' and pg_catalog.length(answer) <= 4000)),
  answered_at timestamptz, answered_by uuid references core.person (id),
  check (not question_open or asked_to is not null),
  check (not question_open or (answer is null and answered_at is null and answered_by is null)),
  check (question_open or asked_to is null
         or (answer is not null and answered_at is not null and answered_by is not null)),
  check ((answered_at is null) = (answered_by is null))
);
comment on table core.comment is
  'A comment on any record (Phase 2): plain text, oldest first; read by whoever sees the record, written by whoever may write on it. A comment with asked_to is a question, closed only by an explicit reply from the person asked.';

-- Only an active core.entity row whose table holds that id (the core.entity_ref_guard pattern from core.file_link).
create trigger entity_ref before insert or update of entity_table, entity_id on core.comment
  for each row execute function core.entity_ref_guard();
create index comment_record on core.comment (entity_table, entity_id, created_at, seq) where deleted_at is null;
-- One open question per record per person.
create unique index comment_one_open_question on core.comment (entity_table, entity_id, asked_to) where question_open;

alter table core.comment enable row level security;

-- ================================================================ the cutover: work.task_comment moves here
-- Preserved: id, body, seq, created_by, edited_at, version, soft-delete state. The old table is left empty; its read
-- path is retired (TaskComments reads core.comment). Runs before audit.track below, so the preserved created_at and
-- created_by survive (audit.stamp() would overwrite them).
insert into core.comment (id, entity_table, entity_id, body, seq, edited_at, created_at, created_by, updated_at,
                          updated_by, version, deleted_at, deleted_by, delete_reason)
select id, 'work.task', task_id, body, seq::int, edited_at, created_at, created_by, updated_at, updated_by, version,
       deleted_at, deleted_by, delete_reason
from work.task_comment;
delete from work.task_comment;

select audit.track('core.comment'::regclass);
select core.index_foreign_keys('core');

-- ================================================================ the notice's kinds
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention', 'alert_contact_reconfirm',
  'alert_due_tomorrow', 'task_commented', 'commented', 'asked'));

-- ================================================================ the record type's rules (core.entity)
-- A comment has no owners of its own: the notice for a new comment is its record's (kind commented, from the door),
-- and the generic "changed by someone else" notice stays out of it, so an admin's removal and its Undo tell nobody
-- twice (QA-603 — the work.task_comment_owners rule, carried over). The two-argument form below is the dispatch the
-- doors use; the one-argument form is what the registry names, so core.owners_of('core.comment', id) finds nobody.
create function core.comment_owners(p_entity text, p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select pg_catalog.unnest(core.owners_of(p_entity, p_id)) $$;
create function core.comment_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select null::uuid where false $$;
-- Seen and changed as its record allows (the core.note_visible / core.note_level pattern).
create function core.comment_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select authz.can_see_as(p_person, c.entity_table, c.entity_id) from core.comment c where c.id = p_id), false) $$;
create function core.comment_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((select authz.record_level(p_person, c.entity_table, c.entity_id) from core.comment c where c.id = p_id),
                  'none'::core.level)
$$;

-- ================================================================ who may write
-- The write rule, by record type (see the header): a task keeps work.can_comment (CMT-01); an achievement keeps its
-- per-type writer list through core.may_write; an author-only private note takes no comment from anyone but its
-- author; every other record takes a comment from whoever can see it.
create function work.comment_may_write(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
  n my.note;
begin
  if me is null then
    return false;
  end if;
  if p_table = 'my.note' then
    select * into n from my.note where id = p_id and deleted_at is null;
    if n.id is not null and n.visibility = 'private' then
      return n.person_id = me;
    end if;
  end if;
  if p_table = 'perf.achievement' then
    return core.may_write(p_table, p_id);
  end if;
  if p_table = 'work.task' then
    select * into t from work.task where id = p_id and deleted_at is null;
    if t.id is null then
      return false;
    end if;
    return work.can_comment(me, t);
  end if;
  return authz.can_see_as(me, p_table, p_id);
end
$$;

-- The record a comment door works on: it must exist and the reader must see it (core.can_see_record) — one place, so
-- the rule is asked once. The doors below take the entity key ('task', 'achievement', 'my_note', 'partner').
create function work.comment_record(p_entity text, p_id uuid) returns core.entity
language sql stable security definer set search_path = ''
as $$ select core.can_see_record(p_entity, p_id) $$;

-- The name the bell and the open-asks list show for the record (a task's number and title, an achievement's number
-- and title, a partner's name); null where the record has no such name, and the bell falls back to the kind's word.
create function work.comment_record_label(p_table text, p_id uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case p_table
    when 'work.task' then (select t.number || ' · ' || t.title from work.task t where t.id = p_id)
    when 'perf.achievement' then (select a.number || ' · ' || a.title from perf.achievement a where a.id = p_id)
    when 'partner.partner' then (select p.number || ' · ' || p.trade_name_en from partner.partner p where p.id = p_id)
    else null end
$$;

-- ================================================================ the doors
-- The comments of a record, oldest first (newest last — reading a discussion in order), and whether the reader may
-- add one. read_at is the read's own time: the screen keeps the newest read, so a late, older re-read never puts the
-- list back (the task-comments race guard, now actually stamped by the server).
create function work.comments(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := work.comment_record(p_entity, p_id);
begin
  return pg_catalog.jsonb_build_object(
    'read_at', core.clock(),
    'can_write', work.comment_may_write(e.table_name, p_id),
    'comments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', c.id, 'author_id', c.created_by,
        'author_name', coalesce(pr.display_name_en, a.nickname_en, a.full_name_en),
        'author_name_ar', coalesce(pr.display_name_ar, a.nickname_ar, a.full_name_ar),
        'body', c.body, 'created_at', c.created_at, 'edited_at', c.edited_at,
        'edited', c.edited_at is not null, 'version', c.version,
        'mine', c.created_by = me,
        'can_edit', c.created_by = me and work.comment_may_write(e.table_name, p_id),
        'can_remove', c.created_by = me or authz.is_admin(),
        'asked_to', c.asked_to,
        'asked_to_name', coalesce(qpr.display_name_en, q.nickname_en, q.full_name_en),
        'asked_to_name_ar', coalesce(qpr.display_name_ar, q.nickname_ar, q.full_name_ar),
        'question_open', c.question_open,
        'answer', c.answer, 'answered_at', c.answered_at, 'answered_by', c.answered_by,
        'answered_by_name', coalesce(apr.display_name_en, an.nickname_en, an.full_name_en),
        'answered_by_name_ar', coalesce(apr.display_name_ar, an.nickname_ar, an.full_name_ar))
        order by c.created_at, c.seq)
      from core.comment c
      left join core.person a on a.id = c.created_by
      left join core.person_profile pr on pr.person_id = c.created_by
      left join core.person q on q.id = c.asked_to
      left join core.person_profile qpr on qpr.person_id = c.asked_to
      left join core.person an on an.id = c.answered_by
      left join core.person_profile apr on apr.person_id = c.answered_by
      where c.entity_table = e.table_name and c.entity_id = p_id and c.deleted_at is null), '[]'::jsonb));
end
$$;

-- Add a comment — or ask a question of one person (p_asked_to). One request, one Undo. The asked person must be
-- someone who may be given work here and who can see the record; asking oneself is refused.
create function work.comment_add(p_entity text, p_id uuid, p_body text, p_asked_to uuid default null) returns jsonb
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
  insert into core.comment (entity_table, entity_id, body, seq, asked_to, question_open)
  values (e.table_name, p_id, b,
          coalesce((select pg_catalog.max(seq) from core.comment
                    where entity_table = e.table_name and entity_id = p_id), 0) + 1,
          p_asked_to, p_asked_to is not null)
  returning id into cid;
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

-- Answer a question: only an explicit reply on that question row by the person asked closes it. A casual comment by
-- the asked person does not close it (work.comment_add never touches question_open), and a closed question cannot be
-- re-answered — only re-asked as a new question. One request, one Undo.
create function work.comment_answer(p_id uuid, p_answer text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c core.comment;
  b text := pg_catalog.btrim(coalesce(p_answer, ''));
  req uuid;
  e core.entity;
begin
  select * into c from core.comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  e := work.comment_record(
    (select k.key from core.entity k where k.table_name = c.entity_table and k.active), c.entity_id);
  if c.asked_to is null or not c.question_open then
    raise exception using errcode = 'P0001', message = 'comment.not_open';
  end if;
  if c.asked_to <> me then
    raise exception using errcode = '42501', message = 'comment.not_asked';
  end if;
  if b = '' then
    raise exception using errcode = 'P0001', message = 'comment.body_required';
  end if;
  if pg_catalog.length(b) > 4000 then
    raise exception using errcode = 'P0001', message = 'comment.too_long';
  end if;
  req := audit.begin('ui', 'comment.answered', pg_catalog.jsonb_build_object('entity', e.key));
  perform audit.write_fields('core.comment', p_id,
    pg_catalog.jsonb_build_object('answer', b, 'answered_at', core.clock(), 'answered_by', me,
                                 'question_open', false));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- Only the author edits a comment; an admin never does. The author must still be able to write on the record.
create function work.comment_edit(p_id uuid, p_body text, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c core.comment;
  b text := pg_catalog.btrim(coalesce(p_body, ''));
  req uuid;
  e core.entity;
begin
  select * into c from core.comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  e := work.comment_record(
    (select k.key from core.entity k where k.table_name = c.entity_table and k.active), c.entity_id);
  if c.created_by <> me then
    raise exception using errcode = '42501', message = 'comment.not_yours';
  end if;
  if not work.comment_may_write(e.table_name, c.entity_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if b = '' then
    raise exception using errcode = 'P0001', message = 'comment.body_required';
  end if;
  if pg_catalog.length(b) > 4000 then
    raise exception using errcode = 'P0001', message = 'comment.too_long';
  end if;
  perform core.check_version('core.comment', p_id, p_version,
    case when b is distinct from c.body then array['body'] else array[]::text[] end);
  req := audit.begin('ui', 'comment.edited', pg_catalog.jsonb_build_object('entity', e.key));
  perform audit.write_fields('core.comment', p_id,
                             pg_catalog.jsonb_build_object('body', b, 'edited_at', core.clock()));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id,
    'version', (select x.version from core.comment x where x.id = p_id), 'request_id', req);
end
$$;

-- Its author removes a comment; so does an admin. One request, one Undo (a soft delete, so Undo brings it back).
create function work.comment_remove(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c core.comment;
  req uuid;
  e core.entity;
begin
  select * into c from core.comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  e := work.comment_record(
    (select k.key from core.entity k where k.table_name = c.entity_table and k.active), c.entity_id);
  if not (c.created_by = me or authz.is_admin()) then
    raise exception using errcode = '42501', message = 'comment.not_yours';
  end if;
  req := audit.begin('ui', 'comment.removed', pg_catalog.jsonb_build_object('entity', e.key), p_reason);
  update core.comment set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- One open question, as the open-asks list serves it: the question, who asked and who is asked, and the record it
-- sits on.
create function work.open_ask_row(c core.comment) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', c.id, 'entity', e.key, 'entity_id', c.entity_id,
    'record', work.comment_record_label(c.entity_table, c.entity_id),
    'body', c.body, 'author_id', c.created_by,
    'author_name', coalesce(pr.display_name_en, a.nickname_en, a.full_name_en),
    'author_name_ar', coalesce(pr.display_name_ar, a.nickname_ar, a.full_name_ar),
    'asked_to', c.asked_to,
    'asked_to_name', coalesce(qpr.display_name_en, q.nickname_en, q.full_name_en),
    'asked_to_name_ar', coalesce(qpr.display_name_ar, q.nickname_ar, q.full_name_ar),
    'created_at', c.created_at)
  from core.entity e
  left join core.person a on a.id = c.created_by
  left join core.person_profile pr on pr.person_id = c.created_by
  left join core.person q on q.id = c.asked_to
  left join core.person_profile qpr on qpr.person_id = c.asked_to
  where e.table_name = c.entity_table and e.active
$$;

-- The open questions asked to me, and the ones I asked: the question, who asked and who is asked, and the record it
-- sits on — only where I can still see the record.
create function work.open_asks() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return pg_catalog.jsonb_build_object(
    'to_me', coalesce((
      select pg_catalog.jsonb_agg(work.open_ask_row(c) order by c.created_at)
      from core.comment c
      where c.asked_to = me and c.question_open and c.deleted_at is null
        and authz.can_see_as(me, c.entity_table, c.entity_id)), '[]'::jsonb),
    'by_me', coalesce((
      select pg_catalog.jsonb_agg(work.open_ask_row(c) order by c.created_at)
      from core.comment c
      where c.created_by = me and c.question_open and c.deleted_at is null
        and authz.can_see_as(me, c.entity_table, c.entity_id)), '[]'::jsonb));
end
$$;

-- ================================================================ grants and the doors (V124)
create function api.comments(p_entity text, p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.comments(p_entity, p_id) $$;
create function api.comment_add(p_entity text, p_id uuid, p_body text, p_asked_to uuid default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.comment_add(p_entity, p_id, p_body, p_asked_to) $$;
create function api.comment_answer(p_id uuid, p_answer text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.comment_answer(p_id, p_answer) $$;
create function api.comment_edit(p_id uuid, p_body text, p_version int) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.comment_edit(p_id, p_body, p_version) $$;
create function api.comment_remove(p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.comment_remove(p_id, p_reason) $$;
create function api.open_asks() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.open_asks() $$;

revoke all on function work.comment_may_write(text, uuid), work.comment_record(text, uuid),
  work.comment_record_label(text, uuid), core.comment_owners(text, uuid), core.comment_owners(uuid),
  core.comment_visible(uuid, uuid), core.comment_level(text, uuid, uuid), work.open_ask_row(core.comment)
  from public;
grant execute on function work.comments(text, uuid), work.comment_add(text, uuid, text, uuid),
  work.comment_answer(uuid, text), work.comment_edit(uuid, text, int), work.comment_remove(uuid, text),
  work.open_asks() to authenticated;
grant execute on function api.comments(text, uuid), api.comment_add(text, uuid, text, uuid),
  api.comment_answer(uuid, text), api.comment_edit(uuid, text, int), api.comment_remove(uuid, text),
  api.open_asks() to authenticated;
