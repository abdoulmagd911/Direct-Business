-- CMT-01 — comments on a task (V657, Stage L, L-5). Whoever sees the task reads its comments, and a comment never widens
-- who sees the task: a head of another department reads nothing of it. Whoever may change the task or helps on it writes
-- one; a viewer, and a colleague who only sees the task, read and add nothing. A new comment tells the task's owner and
-- creator and its helpers, once each, never its author, and nobody about past work. Only the author edits a comment (an
-- admin never does); the author or an admin removes one, and Undo brings it back. A blank or very long comment is
-- refused. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-comment-reads-without-the-task-rule.sql, a-viewer-may-comment.sql,
-- a-comment-tells-the-whole-team.sql, an-admin-edits-any-comment.sql, a-comment-on-past-work-tells-the-team.sql, a-viewer-who-helps-may-comment.sql, an-admin-removal-tells-the-author.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_cmt', 'Test Comment Desk', 'فريق التعليقات');
select set_config('t.head', test.person('Test Comment Head', 'head')::text, true);
select set_config('t.own', test.person('Test Task Owner', 'member')::text, true);
select set_config('t.help', test.person('Test Task Helper', 'member')::text, true);
select set_config('t.peer', test.person('Test Peer Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Comment Viewer', 'viewer')::text, true);
select set_config('t.far', test.person('Test Far Head', 'head', 'test_other_dept')::text, true);
select set_config('t.admin', test.person('Test Comment Admin', 'admin')::text, true);
select set_config('t.vhelp', test.person('Test Viewer Helper', 'viewer')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_cmt')
where id in (current_setting('t.head')::uuid, current_setting('t.own')::uuid, current_setting('t.help')::uuid,
             current_setting('t.peer')::uuid, current_setting('t.viewer')::uuid, current_setting('t.vhelp')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.head')::uuid);

-- the head makes an internal task for the owner and names the helper
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up comment task', 'work_type', 'internal',
  'owner_id', current_setting('t.own'), 'due_on', (core.riyadh_today() + 3)::text)) ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid,
  array[current_setting('t.help')::uuid, current_setting('t.vhelp')::uuid]);

-- the helper writes: the owner and the creator are told once, the author and the colleague are not
select test.as_person(current_setting('t.help')::uuid);
select set_config('t.c1', api.task_comment_add(current_setting('t.t')::uuid, '  Made-up first remark  ')::text, true);
select test.as_owner();
select test.eq((select body from work.task_comment where id = (current_setting('t.c1')::jsonb ->> 'id')::uuid),
  'Made-up first remark', 'a comment is saved as written, trimmed');
select test.eq((select count(*)::int from notify.notification
                where kind = 'task_commented' and person_id = current_setting('t.own')::uuid
                  and request_id = (current_setting('t.c1')::jsonb ->> 'request_id')::uuid), 1,
  'a new comment tells the task''s owner once');
select test.eq((select count(*)::int from notify.notification
                where kind = 'task_commented' and person_id = current_setting('t.head')::uuid
                  and request_id = (current_setting('t.c1')::jsonb ->> 'request_id')::uuid), 1,
  'and the task''s creator once');
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.help')::uuid
                  and request_id = (current_setting('t.c1')::jsonb ->> 'request_id')::uuid), 0,
  'but never the author of the comment');
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.peer')::uuid
                  and request_id = (current_setting('t.c1')::jsonb ->> 'request_id')::uuid), 0,
  'and not a colleague who is not on the task');

-- the owner writes too, and reads both, newest last
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.c2', api.task_comment_add(current_setting('t.t')::uuid, 'Made-up second remark')::text, true);
select test.eq(jsonb_array_length(api.task_comments(current_setting('t.t')::uuid) -> 'comments'), 2,
  'the owner reads the comments');
select test.eq(api.task_comments(current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'body', 'Made-up second remark',
  'newest last');
select test.eq((api.task_comments(current_setting('t.t')::uuid) ->> 'can_write')::boolean, true, 'the owner may write');

-- a colleague who only sees the task, and a viewer, read and add nothing
select test.as_person(current_setting('t.peer')::uuid);
select test.eq(jsonb_array_length(api.task_comments(current_setting('t.t')::uuid) -> 'comments'), 2,
  'a colleague who sees the task reads its comments');
select test.eq((api.task_comments(current_setting('t.t')::uuid) ->> 'can_write')::boolean, false,
  'but may not write: neither owner, creator nor helper');
select test.raises(format('select api.task_comment_add(%L, %L)', current_setting('t.t'), 'Made up'), '42501',
  'a colleague who is not on the task adds no comment', 'access.needs_level');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(jsonb_array_length(api.task_comments(current_setting('t.t')::uuid) -> 'comments'), 2,
  'a viewer reads the comments');
select test.raises(format('select api.task_comment_add(%L, %L)', current_setting('t.t'), 'Made up'), '42501',
  'a viewer reads only: no comment', 'access.needs_level');

-- a viewer who is named a helper still reads only
select test.as_person(current_setting('t.vhelp')::uuid);
select test.eq((api.task_comments(current_setting('t.t')::uuid) ->> 'can_write')::boolean, false,
  'a viewer who helps reads only');
select test.raises(format('select api.task_comment_add(%L, %L)', current_setting('t.t'), 'Made up'), '42501',
  'a viewer who helps adds no comment', 'access.needs_level');

-- a head of another department sees no task, so no comment
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.task_comments(%L)', current_setting('t.t')), '42501',
  'a person who cannot see the task reads none of its comments', 'access.needs_level');
select test.raises(format('select api.task_comment_add(%L, %L)', current_setting('t.t'), 'Made up'), '42501',
  'and writes none', 'access.needs_level');

-- the words
select test.as_person(current_setting('t.own')::uuid);
select test.raises(format('select api.task_comment_add(%L, %L)', current_setting('t.t'), '   '), 'P0001',
  'a comment has words', 'task.comment_body_required');
select test.raises(format('select api.task_comment_add(%L, %L)', current_setting('t.t'), repeat('x', 4001)), 'P0001',
  'a very long comment is refused', 'task.comment_too_long');

-- only the author edits; an admin never does
select test.as_person(current_setting('t.own')::uuid);
select test.raises(format('select api.task_comment_edit(%L, %L, 1)', (current_setting('t.c1')::jsonb ->> 'id'),
  'Made up'), '42501', 'nobody edits the comment of another person', 'task.comment_not_yours');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.task_comment_edit(%L, %L, 1)', (current_setting('t.c1')::jsonb ->> 'id'),
  'Made up'), '42501', 'an admin does not edit the comment of another person', 'task.comment_not_yours');
select test.as_person(current_setting('t.help')::uuid);
select api.task_comment_edit((current_setting('t.c1')::jsonb ->> 'id')::uuid, 'Made-up first remark, corrected', 1);
select test.eq(api.task_comments(current_setting('t.t')::uuid) -> 'comments' -> 0 ->> 'body',
  'Made-up first remark, corrected', 'the author edits their own comment');
select test.ok((api.task_comments(current_setting('t.t')::uuid) -> 'comments' -> 0 ->> 'edited_at') is not null,
  'and it shows as edited');

-- the author removes theirs and Undo brings it back; an admin removes anyone's
select test.as_person(current_setting('t.own')::uuid);
select test.raises(format('select api.task_comment_remove(%L)', (current_setting('t.c1')::jsonb ->> 'id')), '42501',
  'a colleague removes no one else''s comment', 'task.comment_not_yours');
select set_config('t.rm', api.task_comment_remove((current_setting('t.c2')::jsonb ->> 'id')::uuid)::text, true);
select test.eq(jsonb_array_length(api.task_comments(current_setting('t.t')::uuid) -> 'comments'), 1,
  'the author removes their own comment');
select api.undo((current_setting('t.rm')::jsonb ->> 'request_id')::uuid);
select test.eq(jsonb_array_length(api.task_comments(current_setting('t.t')::uuid) -> 'comments'), 2,
  'and Undo brings it back');
select test.as_person(current_setting('t.admin')::uuid);
select api.task_comment_remove((current_setting('t.c1')::jsonb ->> 'id')::uuid, 'Made up reason');
select test.eq(jsonb_array_length(api.task_comments(current_setting('t.t')::uuid) -> 'comments'), 1,
  'an admin removes anyone''s comment');

-- every change is on the change log, and past work tells nobody
select test.as_owner();
select test.ok(exists (select 1 from audit.change where table_name = 'work.task_comment'
                       and row_id = (current_setting('t.c1')::jsonb ->> 'id')::uuid),
  'a comment is on the change log');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.past', api.task_create(jsonb_build_object('title', 'Made-up past comment task',
  'work_type', 'internal', 'owner_id', current_setting('t.own'),
  'happened_on', core.riyadh_today() - 200, 'due_on', core.riyadh_today() - 190))::text, true);
select api.task_helpers_set((current_setting('t.past')::jsonb ->> 'id')::uuid, array[current_setting('t.help')::uuid]);
select test.as_person(current_setting('t.help')::uuid);
select set_config('t.cp', api.task_comment_add((current_setting('t.past')::jsonb ->> 'id')::uuid,
  'Made-up remark on old work')::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where kind = 'task_commented'
                and request_id = (current_setting('t.cp')::jsonb ->> 'request_id')::uuid), 0,
  'a comment on past work tells nobody');

-- an admin removes the author's comment and Undo brings it back: the author is told of neither (QA-603)
select test.as_person(current_setting('t.help')::uuid);
select set_config('t.c3', api.task_comment_add(current_setting('t.t')::uuid, 'Made-up third remark')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.rm3', api.task_comment_remove((current_setting('t.c3')::jsonb ->> 'id')::uuid)::text, true);
select api.undo((current_setting('t.rm3')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.help')::uuid
                and kind in ('changed_by_other', 'followed_change')), 0,
  'an admin removing a comment, and Undo, tell its author nothing twice');
