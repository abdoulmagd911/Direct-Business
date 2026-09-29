-- UNDO-02 — undo reverts only the fields its request changed (A16; the old app's undo overwrote the whole row and
-- silently took back later edits to other fields): a rename undone after someone else set the Arabic name keeps their
-- Arabic name, and the undo logs only the field it put back.
-- Sabotage: supabase/tests/sabotage/undo-rolls-back-the-whole-row.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.dep', test.department('undo_two')::text, true);

select set_config('t.r1', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'First Rename' where id = current_setting('t.dep')::uuid;
select test.done();
select set_config('t.r2', test.act(current_setting('t.head')::uuid)::text, true);
update core.department set name_ar = 'اسم من شخص آخر' where id = current_setting('t.dep')::uuid;
select test.done();

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.u1', api.undo(current_setting('t.r1')::uuid) ->> 'request_id', true);
select test.as_owner();
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Undo Two',
  'the rename is undone');
select test.eq((select name_ar from core.department where id = current_setting('t.dep')::uuid), 'اسم من شخص آخر',
  'the Arabic name someone else set since stays');
select test.eq((select array_agg(f order by f) from audit.change c, unnest(c.fields) f
                where c.request_id = current_setting('t.u1')::uuid), array['name_en'],
  'the undo logs only the field it put back');
select test.eq((select undone_by from audit.request where id = current_setting('t.r2')::uuid), null::uuid,
  'the later request is untouched');
