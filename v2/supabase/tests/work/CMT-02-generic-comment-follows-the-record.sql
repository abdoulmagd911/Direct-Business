-- CMT-02 — generic comments follow the record (Phase 2). A comment is read by whoever can see its record and by
-- nobody else, on a task and on an achievement alike: a head of another department reads none of a task's comments,
-- and a member of another department reads none of an achievement's. Whoever may see the record and holds Own or more
-- on its page writes one (FIX-03 P1a) — a colleague who merely sees it writes too, a Viewer reads only. Only the
-- author edits a comment (an admin never does); the author or an admin removes one, and Undo brings it back. A new
-- comment tells the record's owners once each, never its author; a question is also put to the person asked. One open
-- question per record per person; only an explicit reply by the person asked closes it — a casual comment by them does
-- not — and a closed question cannot be re-answered, only re-asked as a new question. A private note takes no comment
-- from anyone but its author. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-comment-reads-without-the-task-rule.sql, a-viewer-may-comment.sql,
-- a-comment-tells-the-whole-team.sql, an-admin-edits-any-comment.sql, a-comment-on-past-work-tells-the-team.sql,
-- a-viewer-who-helps-may-comment.sql, an-admin-removal-tells-the-author.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_cmt2', 'Test Generic Comments Desk', 'فريق التعليقات العامة');
select set_config('t.own', test.person('Test Generic Owner', 'member')::text, true);
select set_config('t.help', test.person('Test Generic Helper', 'member')::text, true);
select set_config('t.peer', test.person('Test Generic Peer', 'member')::text, true);
select set_config('t.far', test.person('Test Far Head', 'head', 'test_other_dept')::text, true);
select set_config('t.ops', test.person('Test Other Department', 'member', 'operations')::text, true);
select set_config('t.admin', test.person('Test Generic Admin', 'admin')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_cmt2')
where id in (current_setting('t.own')::uuid, current_setting('t.help')::uuid, current_setting('t.peer')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.admin')::uuid);
-- the new kinds (commented, asked) entered the default after this test's clock, so the test turns them on for its
-- own department explicitly (a department row beats the global rows in core.setting_at)
insert into core.setting (key, department_id, value, valid_from, reason, created_by)
values ('notify.kinds_enabled', test.department('commercial'),
        (select default_value from core.setting_def where key = 'notify.kinds_enabled'),
        core.riyadh_today(), 'made up: the new comment kinds are on for this team',
        current_setting('t.admin')::uuid);

-- the owner makes their own task (owner and creator in one person) and names the helper; the admin opens the
-- commercial plan and the owner logs an achievement there
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up generic task',
  'work_type', 'internal')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid, array[current_setting('t.help')::uuid]);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up generic work',
  'happened_on', '2026-09-21')) ->> 'id', true);

-- visibility follows the record: a colleague who sees the task reads its comments, oldest first, with the read's own
-- time; a head of another department reads none of them and writes none
select set_config('t.c1', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up first remark')::text, true);
select test.as_person(current_setting('t.peer')::uuid);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 1,
  'a colleague who sees the task reads its comments');
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 0 ->> 'body',
  'Made-up first remark', 'oldest first');
select test.ok((api.comments('task', current_setting('t.t')::uuid) ->> 'read_at') is not null,
  'and the read carries its own time');
select test.eq((api.comments('task', current_setting('t.t')::uuid) ->> 'can_write')::boolean, true,
  'and may write: Own on Tasks is enough (P1a)');
select set_config('t.cp', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up peer remark')::text, true);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 2,
  'the colleague adds a comment');
select api.comment_remove((current_setting('t.cp')::jsonb ->> 'id')::uuid);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 1,
  'and removes their own again');
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.comments(%L, %L)', 'task', current_setting('t.t')), '42501',
  'a person who cannot see the task reads none of its comments', 'access.needs_level');
select test.raises(format('select api.comment_add(%L, %L, %L)', 'task', current_setting('t.t'), 'Made up'), '42501',
  'and writes none', 'access.needs_level');

-- and on an achievement: the whole department reads, nobody of another department; a colleague who sees it writes
-- too (P1a: Own on KPIs is enough)
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.ca', api.comment_add('achievement', current_setting('t.a')::uuid,
  'Made-up remark on the work')::text, true);
select test.as_person(current_setting('t.peer')::uuid);
select test.eq(jsonb_array_length(api.comments('achievement', current_setting('t.a')::uuid) -> 'comments'), 1,
  'a colleague in the department reads the achievement''s comments');
select test.eq((api.comments('achievement', current_setting('t.a')::uuid) ->> 'can_write')::boolean, true,
  'and may write on it: Own on KPIs is enough (P1a)');
select set_config('t.cpa', api.comment_add('achievement', current_setting('t.a')::uuid,
  'Made-up peer remark')::text, true);
select test.eq(jsonb_array_length(api.comments('achievement', current_setting('t.a')::uuid) -> 'comments'), 2,
  'the colleague adds a comment');
select api.comment_remove((current_setting('t.cpa')::jsonb ->> 'id')::uuid);
select test.eq(jsonb_array_length(api.comments('achievement', current_setting('t.a')::uuid) -> 'comments'), 1,
  'and removes their own again');
select test.as_person(current_setting('t.ops')::uuid);
select test.raises(format('select api.comments(%L, %L)', 'achievement', current_setting('t.a')), '42501',
  'a member of another department reads none of them', 'access.needs_level');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.comments('achievement', current_setting('t.a')::uuid) ->> 'can_write')::boolean, true,
  'the achievement''s owner may write');
select api.comment_add('achievement', current_setting('t.a')::uuid, 'Made-up owner remark');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where kind = 'commented' and person_id = current_setting('t.own')::uuid
                  and request_id = (current_setting('t.ca')::jsonb ->> 'request_id')::uuid), 1,
  'an admin''s comment on the achievement tells its owner once');
select test.eq((select count(*)::int from notify.notification
                where kind = 'commented' and person_id = current_setting('t.admin')::uuid
                  and request_id = (current_setting('t.ca')::jsonb ->> 'request_id')::uuid), 0,
  'and never its author');

-- telling people on the task: the helper writes, and the owner — owner and creator in one person — is told once, not
-- twice; the author and a colleague who is not on the task are told nothing
select test.as_person(current_setting('t.help')::uuid);
select set_config('t.c2', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up helper remark')::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where kind = 'commented' and person_id = current_setting('t.own')::uuid
                  and request_id = (current_setting('t.c2')::jsonb ->> 'request_id')::uuid), 1,
  'a new comment tells the task''s owner once, though owner and creator in one person');
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.help')::uuid
                  and request_id = (current_setting('t.c2')::jsonb ->> 'request_id')::uuid), 0,
  'but never the author of the comment');
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.peer')::uuid
                  and request_id = (current_setting('t.c2')::jsonb ->> 'request_id')::uuid), 0,
  'and not a colleague who is not on the task');

-- only the author edits; an admin never does
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.comment_edit(%L, %L, 1)', (current_setting('t.c2')::jsonb ->> 'id'),
  'Made up'), '42501', 'nobody edits the comment of another person', 'comment.not_yours');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.comment_edit(%L, %L, 1)', (current_setting('t.c2')::jsonb ->> 'id'),
  'Made up'), '42501', 'an admin does not edit the comment of another person', 'comment.not_yours');
select test.as_person(current_setting('t.help')::uuid);
select api.comment_edit((current_setting('t.c2')::jsonb ->> 'id')::uuid, 'Made-up helper remark, corrected', 1);
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'body',
  'Made-up helper remark, corrected', 'the author edits their own comment');
select test.eq((api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'edited')::boolean, true,
  'and it shows as edited');
select test.eq((api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'version')::int, 2,
  'and the version moves on');

-- the author removes theirs and Undo brings it back; an admin removes anyone's
select test.as_person(current_setting('t.help')::uuid);
select set_config('t.rm', api.comment_remove((current_setting('t.c2')::jsonb ->> 'id')::uuid)::text, true);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 1,
  'the author removes their own comment');
select api.undo((current_setting('t.rm')::jsonb ->> 'request_id')::uuid);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 2,
  'and Undo brings it back');
select test.as_person(current_setting('t.admin')::uuid);
select api.comment_remove((current_setting('t.c1')::jsonb ->> 'id')::uuid, 'Made up reason');
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 1,
  'an admin removes anyone''s comment');

-- questions: one open question per record per person; the person asked is put to it, once, and a question to someone
-- else on the same record still opens
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.q1', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up first question',
  current_setting('t.help')::uuid)::text, true);
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'question_open', 'true',
  'a comment with someone asked is an open question');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where kind = 'asked' and person_id = current_setting('t.help')::uuid
                  and request_id = (current_setting('t.q1')::jsonb ->> 'request_id')::uuid), 1,
  'and the person asked is put to it once');
select test.as_person(current_setting('t.own')::uuid);
select test.raises(format('select api.comment_add(%L, %L, %L, %L)', 'task', current_setting('t.t'),
  'Made-up second question', current_setting('t.help')), 'P0001',
  'one open question per record per person', 'comment.already_asked');
select set_config('t.q2', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up question to a colleague',
  current_setting('t.peer')::uuid)::text, true);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 3,
  'a question to someone else on the same record still opens');

-- a casual comment by the person asked does not close it; only their explicit reply does
select test.as_person(current_setting('t.help')::uuid);
select api.comment_add('task', current_setting('t.t')::uuid, 'Made-up passing remark');
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'question_open', 'true',
  'a casual comment by the person asked leaves the question open');
select test.raises(format('select api.comment_answer(%L, %L)', (current_setting('t.q2')::jsonb ->> 'id'),
  'Made up'), '42501', 'only the person asked may answer a question', 'comment.not_asked');
select api.comment_answer((current_setting('t.q1')::jsonb ->> 'id')::uuid, 'Made-up answer');
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'question_open', 'false',
  'their explicit reply closes it');
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'answer', 'Made-up answer',
  'and records the answer');
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'answered_by',
  current_setting('t.help'), 'and who answered it');
select test.ok((api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 1 ->> 'answered_at') is not null,
  'and when');

-- a closed question cannot be re-answered, only re-asked as a new question
select test.as_person(current_setting('t.help')::uuid);
select test.raises(format('select api.comment_answer(%L, %L)', (current_setting('t.q1')::jsonb ->> 'id'),
  'Made up again'), 'P0001', 'a closed question cannot be re-answered', 'comment.not_open');
select test.as_person(current_setting('t.own')::uuid);
select api.comment_add('task', current_setting('t.t')::uuid, 'Made-up follow-up question',
  current_setting('t.help')::uuid);
select test.eq(api.comments('task', current_setting('t.t')::uuid) -> 'comments' -> 4 ->> 'question_open', 'true',
  'only re-asked as a new question');

-- the open asks: asked to me, and asked by me, with the record each sits on
select test.as_person(current_setting('t.help')::uuid);
select test.eq(jsonb_array_length(api.open_asks() -> 'to_me'), 1, 'one open question is asked to me');
select test.eq(api.open_asks() -> 'to_me' -> 0 ->> 'body', 'Made-up follow-up question', 'the open one, not the closed');
select set_config('t.rec', api.open_asks() -> 'to_me' -> 0 ->> 'record', true);
select test.as_owner();
select test.eq(current_setting('t.rec'),
  (select number || ' · ' || title from work.task where id = current_setting('t.t')::uuid),
  'with the record it sits on');
select test.as_person(current_setting('t.own')::uuid);
select test.eq(jsonb_array_length(api.open_asks() -> 'by_me'), 2, 'two open questions were asked by me');

-- a private note takes no comment from anyone but its author
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up quiet thought',
  'body', 'Made-up words for me alone')) ->> 'id', true);
select test.eq((api.comments('my_note', current_setting('t.n')::uuid) ->> 'can_write')::boolean, true,
  'the author may comment on their own private note');
select api.comment_add('my_note', current_setting('t.n')::uuid, 'Made-up note to self');
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.comments(%L, %L)', 'my_note', current_setting('t.n')), '42501',
  'a colleague reads none of a private note''s comments', 'access.needs_level');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.comments(%L, %L)', 'my_note', current_setting('t.n')), '42501',
  'an admin reads none of a private note''s comments either (my.note_visible: admins never)', 'access.needs_level');
select test.raises(format('select api.comment_add(%L, %L, %L)', 'my_note', current_setting('t.n'), 'Made up'),
  '42501', 'and an add is refused', 'access.needs_level');
