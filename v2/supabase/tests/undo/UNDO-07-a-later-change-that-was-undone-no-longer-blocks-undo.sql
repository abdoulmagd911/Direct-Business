-- UNDO-07 — a later change that was itself undone no longer blocks Undo (A16, #186's hand-entry round): add a list
-- value, rename it, undo the rename, and the add can be undone — the value is gone. A later rename still in force blocks
-- as before, and one undone and then redone is in force again and blocks too. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-undone-change-still-blocks-undo.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);

-- add, rename, undo the rename: the add can be undone
select set_config('t.r1', api.list_save('contact_role', null,
  '{"key": "made_up_role", "name_en": "Made up role", "name_ar": "دور مختلق"}')::text, true);
select set_config('t.r2', api.list_save('contact_role', (current_setting('t.r1')::jsonb ->> 'id')::uuid,
  '{"name_en": "Made up role renamed"}', (current_setting('t.r1')::jsonb ->> 'version')::int)::text, true);
select api.undo((current_setting('t.r2')::jsonb ->> 'request_id')::uuid);
do $$
begin
  perform api.undo((current_setting('t.r1')::jsonb ->> 'request_id')::uuid);
  perform set_config('t.undid', 'undone', true);
exception when serialization_failure then
  perform set_config('t.undid', 'refused', true);
end $$;
select test.eq(current_setting('t.undid'), 'undone',
  'a rename taken back no longer blocks undoing the add: the value is gone');
select test.as_owner();
select test.eq((select count(*)::int from partner.contact_role
                where id = (current_setting('t.r1')::jsonb ->> 'id')::uuid and deleted_at is null), 0, 'the value is gone');

-- a rename still in force blocks
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r3', api.list_save('contact_role', null,
  '{"key": "made_up_other", "name_en": "Made up other", "name_ar": "دور آخر مختلق"}')::text, true);
select set_config('t.r4', api.list_save('contact_role', (current_setting('t.r3')::jsonb ->> 'id')::uuid,
  '{"name_en": "Made up other renamed"}', (current_setting('t.r3')::jsonb ->> 'version')::int)::text, true);
select test.raises(format('select api.undo(%L)', current_setting('t.r3')::jsonb ->> 'request_id'), '40001',
  'a later rename still in force blocks undoing the add', 'undo.changed_since');

-- undone and redone, the rename is in force again and blocks
select set_config('t.u4', api.undo((current_setting('t.r4')::jsonb ->> 'request_id')::uuid) ->> 'request_id', true);
select api.undo(current_setting('t.u4')::uuid);
select test.as_owner();
select test.eq((select name_en from partner.contact_role where id = (current_setting('t.r3')::jsonb ->> 'id')::uuid),
  'Made up other renamed', 'the rename is redone');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r3')::jsonb ->> 'request_id'), '40001',
  'and blocks undoing the add again', 'undo.changed_since');
