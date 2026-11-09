-- FIX10-01 — Undo semantics per row type (FIX-10 D22). A comment-remove is undoable by its author even when an
-- admin removed it (F056 — core.comment has no entity row, so the Full and owners branches were dead for comments);
-- a peer who neither wrote the comment nor removed it still cannot undo it. A member's contact-remove Undo restores
-- the contact (F118). Undoing a "File added" row sets the file back to pending, not stored (F197) — it does not
-- delete the file; undoing its registration removes it. Every value is made up.
select set_config('t.mgr', test.person('Test Undo Manager', 'manager')::text, true);
select set_config('t.peer', test.person('Test Undo Peer', 'member')::text, true);
select set_config('t.am1', test.person('Test Undo Member', 'member')::text, true);
select set_config('t.admin', test.person('Test Undo Admin', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_undo10', 'Test Undo Desk', 'فريق التراجع');
update core.person set team_id = (select id from core.team where code = 'test_undo10')
where id in (current_setting('t.mgr')::uuid, current_setting('t.peer')::uuid);

-- F056: the manager writes a comment; an admin removes it; the manager undoes the remove
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up undo task', 'work_type', 'internal',
  'owner_id', current_setting('t.mgr'), 'due_on', (core.riyadh_today() + 3)::text)) ->> 'id', true);
select set_config('t.c', api.comment_add('task', current_setting('t.t')::uuid, 'Made-up remark to undo')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.rm', api.comment_remove((current_setting('t.c')::jsonb ->> 'id')::uuid, 'Made up reason')::text, true);
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 0,
  'an admin removes the manager''s comment');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.rm')::jsonb ->> 'request_id'),
  'its author undoes the admin''s remove');
select test.eq(jsonb_array_length(api.comments('task', current_setting('t.t')::uuid) -> 'comments'), 1,
  'and the comment is back');

-- a peer who neither wrote it nor removed it cannot undo it
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.rm2', api.comment_remove((current_setting('t.c')::jsonb ->> 'id')::uuid, 'Made up reason')::text, true);
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.rm2')::jsonb ->> 'request_id'),
  '42501', 'a peer cannot undo another''s comment remove', 'undo.not_allowed');
select test.as_owner();
select test.eq((select deleted_at is not null from core.comment
                where id = (current_setting('t.c')::jsonb ->> 'id')::uuid), true, 'the comment stays removed');

-- F118: a member removes a contact on their own partner and undoes it
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p1', api.partner_create('{"trade_name_en": "Made Up Undo Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.k1', api.contact_save(current_setting('t.p1')::uuid, null,
  '{"name_en": "Made Up Undo Contact"}') ->> 'id', true);
select set_config('t.rk1', api.contacts_remove(array[current_setting('t.k1')::uuid], 'made up: left')::text, true);
select test.runs(format('select api.undo(%L)', current_setting('t.rk1')::jsonb ->> 'request_id'),
  'a member undoes their own contact remove');
select test.as_owner();
select test.eq((select deleted_at is null from partner.contact where id = current_setting('t.k1')::uuid), true,
  'the contact is back');

-- F197: undoing a "File added" row sets the file back to pending; undoing its registration removes it
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.f', api.file_begin('partner', current_setting('t.p1')::uuid, 'rate_sheet', 'attachment',
  'rates 2027.PDF', 1000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.f')::jsonb ->> 'path'), 'its uploader writes it');
select set_config('t.ff', api.file_finish((current_setting('t.f')::jsonb ->> 'id')::uuid, repeat('C', 64))::text, true);
select test.runs(format('select api.undo(%L)', current_setting('t.ff')::jsonb ->> 'request_id'),
  'undoing the file finish runs');
select test.as_owner();
select test.eq((select status from core.file where id = (current_setting('t.f')::jsonb ->> 'id')::uuid),
  'pending', 'the file is pending again, not deleted');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.f')::jsonb ->> 'request_id'),
  'undoing the file registration runs');
select test.as_owner();
select test.eq((select deleted_at is not null from core.file where id = (current_setting('t.f')::jsonb ->> 'id')::uuid),
  true, 'the file is removed');
