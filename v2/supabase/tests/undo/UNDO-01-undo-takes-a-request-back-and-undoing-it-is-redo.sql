-- UNDO-01 — undo takes a request back and is itself a request; undoing the undo is redo (§3.3, D7): the fields go back,
-- the undo is kind 'undo' naming what it undid and the original is marked undone; an undone request is not undone twice;
-- redo brings the change back and clears the mark; undoing the redo undoes the change again and marks it again. What
-- the system wrote (the registry sync) is not a person's to undo.
-- Sabotage: supabase/tests/sabotage/undoing-a-redo-leaves-the-original-live.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('undo_one')::text, true);

select set_config('t.r1', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'Renamed Once', name_ar = 'اسم تجريبي' where id = current_setting('t.dep')::uuid;
select test.done();

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.u1', api.undo(current_setting('t.r1')::uuid) ->> 'request_id', true);
select test.as_owner();
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Undo One',
  'undo puts the name back');
select test.eq((select name_ar from core.department where id = current_setting('t.dep')::uuid), null::text,
  'and the Arabic name it had set');
select test.eq((select kind from audit.request where id = current_setting('t.u1')::uuid), 'undo',
  'the undo is itself a request');
select test.eq((select undo_of from audit.request where id = current_setting('t.u1')::uuid),
  current_setting('t.r1')::uuid, 'naming what it undid');
select test.eq((select undone_by from audit.request where id = current_setting('t.r1')::uuid),
  current_setting('t.u1')::uuid, 'and the original is marked undone');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), 'P0001',
  'an undone request is not undone twice', 'undo.already_undone');
select set_config('t.u2', api.undo(current_setting('t.u1')::uuid) ->> 'request_id', true);
select test.as_owner();
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Renamed Once',
  'undoing the undo is redo: the change is back');
select test.eq((select undone_by from audit.request where id = current_setting('t.r1')::uuid), null::uuid,
  'and the original is no longer undone');
select test.eq((select undone_by from audit.request where id = current_setting('t.u1')::uuid),
  current_setting('t.u2')::uuid, 'the undo is marked undone by the redo');

select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.u2')::uuid);
select test.as_owner();
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Undo One',
  'undoing the redo undoes the change again');
select test.eq((select undone_by from audit.request where id = current_setting('t.r1')::uuid),
  current_setting('t.u1')::uuid, 'the original is undone again, by the undo that is live again');
select test.eq((select undone_by from audit.request where id = current_setting('t.u1')::uuid), null::uuid,
  'and that undo is live again');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', gen_random_uuid()), 'P0002', 'an unknown request',
  'common.not_found');
select test.as_owner();
select set_config('t.sync', (select id::text from audit.request where kind = 'system' and label_key = 'registry.synced'
                             order by at limit 1), true);
select test.ok(current_setting('t.sync') <> '', 'the registry sync is a system request');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.sync')), 'P0001',
  'what the system wrote is not a person''s to undo, an admin''s included', 'undo.not_undoable');
