-- V657 (Stage L, L-5): comments on a task. One new table, work.task_comment, and four doors: the list, add, edit and
-- remove. Forward-only (V103).
--   * Read: whoever can see the task reads its comments — the task's own rule (authz.can_see_as on work.task), asked on
--     every read; a comment never widens who sees the task, and a private or other-department task's comments stay
--     unreadable to a person who cannot see the task.
--   * Write: whoever may change the task (work.can_edit_task: Full on Tasks, or Own and its owner or creator) or helps
--     on it (V240) with Own on Tasks — and can see it. A viewer, even one who helps, reads only.
--   * Own comments: only the author edits one; the author or an admin removes one (an admin never edits). Each is one
--     request with Undo (D7); removing is a soft delete, so Undo brings it back.
--   * Telling people: a new comment tells the task's owner, creator and helpers in the app (kind task_commented), never
--     the author, never on past work (V491). No email, no push.
--   * No attachments in this release (files stay in the one library, L-4).
-- The table has row-level security on and no policy, like its siblings work.task_helper and work.task_ref: nobody reads
-- it directly; the doors below ask the task's rule themselves.

-- ================================================================ the table
create table work.task_comment (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references work.task (id),
  body text not null check (pg_catalog.btrim(body) <> '' and pg_catalog.length(body) <= 4000),
  -- the order written, when two comments carry the same instant (one request)
  seq bigint generated always as identity,
  edited_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create index task_comment_task on work.task_comment (task_id, created_at, seq) where deleted_at is null;
comment on table work.task_comment is
  'A comment on a task (V657): plain text, newest last; read by whoever sees the task, written by whoever may change it or helps on it.';

alter table work.task_comment enable row level security;
select audit.track('work.task_comment'::regclass);
select core.index_foreign_keys('work');

-- ================================================================ the notice's kind
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention', 'alert_contact_reconfirm',
  'alert_due_tomorrow', 'task_commented'));

-- ================================================================ the record type's rules (core.entity)
-- work.row_of as the tasks migration wrote it, with the comment's task.
create or replace function work.row_of(p_table text, p_id uuid, out task_id uuid, out project_id uuid, out department_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
begin
  case p_table
    when 'work.task' then task_id := p_id;
    when 'work.task_helper' then select x.task_id into task_id from work.task_helper x where x.id = p_id;
    when 'work.action_item' then select x.task_id into task_id from work.action_item x where x.id = p_id;
    when 'work.action_item_helper' then
      select a.task_id into task_id from work.action_item_helper x join work.action_item a on a.id = x.action_item_id
      where x.id = p_id;
    when 'work.task_ref' then select x.task_id into task_id from work.task_ref x where x.id = p_id;
    when 'work.task_contact' then select x.task_id into task_id from work.task_contact x where x.id = p_id;
    when 'work.task_status_change' then select x.task_id into task_id from work.task_status_change x where x.id = p_id;
    when 'work.task_comment' then select x.task_id into task_id from work.task_comment x where x.id = p_id;
    when 'work.project' then project_id := p_id;
    when 'work.project_health' then select x.project_id into project_id from work.project_health x where x.id = p_id;
    else null;
  end case;
  department_id := coalesce((select x.department_id from work.task x where x.id = task_id),
                            (select x.department_id from work.project x where x.id = project_id));
end
$$;

-- A comment has no owners of its own: the notice for a new comment is the task's (task_commented, from the door), and
-- the generic "changed by someone else" notice stays out of it, so an admin's removal and its Undo tell nobody twice
-- (QA-603).
create function work.task_comment_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select null::uuid where false $$;

-- ================================================================ who may write
-- Whoever can see the task and may change it (Full on Tasks, or Own and its owner or creator) or helps on it — and a
-- helper still needs Own on Tasks: a viewer who helps reads only (the Architect's change request on #356).
create function work.can_comment(p_person uuid, t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select authz.can_see_as(p_person, 'work.task', t.id)
         and (work.can_edit_task(p_person, t)
              or (authz.level_of(p_person, 'tasks') >= 'own'
                  and exists (select 1 from work.task_helper h
                              where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null)))
$$;

-- The task a person may comment on (or read the comments of): refused with the same words the tasks use.
create function work.task_for_comments(p_task uuid, p_write boolean) returns work.task
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_task and deleted_at is null;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not authz.can_see_as(me, 'work.task', p_task) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'view')::text;
  end if;
  if p_write and not work.can_comment(me, t) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  return t;
end
$$;

-- ================================================================ the doors
-- The comments of a task, oldest first (newest last), and whether the reader may add one.
create function work.task_comments(p_task uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_for_comments(p_task, false);
begin
  return pg_catalog.jsonb_build_object(
    'can_write', work.can_comment(me, t),
    'comments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', c.id, 'body', c.body, 'author_id', c.created_by, 'created_at', c.created_at,
        'edited_at', c.edited_at, 'version', c.version, 'mine', c.created_by = me,
        'can_edit', c.created_by = me and work.can_comment(me, t),
        'can_remove', c.created_by = me or authz.is_admin())
        order by c.created_at, c.seq)
      from work.task_comment c where c.task_id = p_task and c.deleted_at is null), '[]'::jsonb));
end
$$;

create function work.task_comment_add(p_task uuid, p_body text) returns jsonb
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
  if not work.task_is_past(t) then
    for p in select distinct o from work.task_owners(p_task) o loop
      perform notify.push_assigned(p, 'task_commented', 'work.task', p_task,
                                   pg_catalog.jsonb_build_object('number', t.number));
    end loop;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
end
$$;

-- Only the author edits a comment; an admin never does.
create function work.task_comment_edit(p_id uuid, p_body text, p_version int) returns jsonb
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
  if c.created_by <> me then
    raise exception using errcode = '42501', message = 'task.comment_not_yours';
  end if;
  perform work.task_for_comments(c.task_id, true);
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

-- Its author removes a comment; so does an admin. One request, one Undo.
create function work.task_comment_remove(p_id uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c work.task_comment;
  req uuid;
begin
  select * into c from work.task_comment where id = p_id and deleted_at is null;
  if me is null or c.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform work.task_for_comments(c.task_id, false);
  if not (c.created_by = me or authz.is_admin()) then
    raise exception using errcode = '42501', message = 'task.comment_not_yours';
  end if;
  req := audit.begin('ui', 'task.comment_removed',
                     pg_catalog.jsonb_build_object('number', (select t.number from work.task t where t.id = c.task_id)),
                     p_reason);
  update work.task_comment set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- ================================================================ grants and the doors (V124)
create function api.task_comments(p_task uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.task_comments(p_task) $$;
create function api.task_comment_add(p_task uuid, p_body text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_comment_add(p_task, p_body) $$;
create function api.task_comment_edit(p_id uuid, p_body text, p_version int) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.task_comment_edit(p_id, p_body, p_version) $$;
create function api.task_comment_remove(p_id uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_comment_remove(p_id, p_reason) $$;

revoke all on function work.can_comment(uuid, work.task), work.task_for_comments(uuid, boolean),
  work.task_comment_owners(uuid) from public;
grant execute on function work.task_comments(uuid), work.task_comment_add(uuid, text),
  work.task_comment_edit(uuid, text, int), work.task_comment_remove(uuid, text) to authenticated;
grant execute on function api.task_comments(uuid), api.task_comment_add(uuid, text),
  api.task_comment_edit(uuid, text, int), api.task_comment_remove(uuid, text) to authenticated;
