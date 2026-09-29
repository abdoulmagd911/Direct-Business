-- UNDO-03 — undo is all or nothing (A16): a request that renamed a department and a team is not undone at all once
-- someone renamed the team again; the refusal names the record, the field, who changed it and when. Undone in order —
-- the later request first — both go back.
-- Sabotage: supabase/tests/sabotage/undo-does-what-it-can.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.dep', test.department('undo_three')::text, true);
insert into core.team (department_id, code, name_en) values (current_setting('t.dep')::uuid, 'desk', 'Desk');
select set_config('t.team', (select id::text from core.team where department_id = current_setting('t.dep')::uuid), true);

select set_config('t.r1', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'Dept Renamed' where id = current_setting('t.dep')::uuid;
update core.team set name_en = 'Desk Renamed' where id = current_setting('t.team')::uuid;
select test.done();
select set_config('t.r2', test.act(current_setting('t.head')::uuid)::text, true);
update core.team set name_en = 'Desk Renamed Again' where id = current_setting('t.team')::uuid;
select test.done();

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), '40001',
  'undo refuses when a later change touched the same field', 'undo.changed_since');
do $$
declare
  d text;
begin
  perform api.undo(current_setting('t.r1')::uuid);
exception when serialization_failure then
  get stacked diagnostics d = pg_exception_detail;
  perform set_config('t.detail', d, true);
end $$;
select test.as_owner();
select test.eq(current_setting('t.detail')::jsonb ->> 'entity', 'core.team', 'the refusal names the record type');
select test.eq(current_setting('t.detail')::jsonb ->> 'id', current_setting('t.team'), 'the record');
select test.eq(current_setting('t.detail')::jsonb ->> 'field', 'name_en', 'the field');
select test.eq(current_setting('t.detail')::jsonb ->> 'by', current_setting('t.head'), 'who changed it since');
select test.ok(current_setting('t.detail')::jsonb ->> 'at' is not null, 'and when');
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Dept Renamed',
  'nothing is undone: the department keeps the name the request gave it');
select test.eq((select undone_by from audit.request where id = current_setting('t.r1')::uuid), null::uuid,
  'and the request is not marked undone');

select test.as_person(current_setting('t.head')::uuid);
select api.undo(current_setting('t.r2')::uuid);
select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.r1')::uuid);
select test.as_owner();
select test.eq((select name_en from core.team where id = current_setting('t.team')::uuid), 'Desk',
  'the later request undone first, both go back: the team');
select test.eq((select name_en from core.department where id = current_setting('t.dep')::uuid), 'Undo Three',
  'and the department');
