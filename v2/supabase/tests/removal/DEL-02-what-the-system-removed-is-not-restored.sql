-- DEL-02 — what the system removed is not a person's to restore (V177; the production finding W10): a row a migration,
-- the registry sync or a job removed — V176's retired grants, V97's Settings levels, a replaced default — is part of
-- how the app is built. Recently deleted does not list it, even to an admin, and Restore refuses it
-- (restore.system_removal); a person's own removal is listed and restored as before. Made up.
-- Sabotages: supabase/tests/sabotage/the-system-removals-listed.sql,
--            supabase/tests/sabotage/the-system-removals-restored.sql,
--            supabase/tests/sabotage/a-job-removal-counts-as-a-persons.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select test.as_owner();
select set_config('t.sys', (select c.id::text from core.role_capability c
                            where c.delete_reason = 'V176: the capability is retired' limit 1), true);
select test.ok(current_setting('t.sys') <> '', 'a migration removed rows: V176''s retired grants');

-- a person removes one contact; a job removes another
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up System Removals',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
  'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.mine', api.contact_save(current_setting('t.pid')::uuid, null,
  '{"name_en": "Made Up Contact Removed By A Person"}') ->> 'id', true);
select set_config('t.job', api.contact_save(current_setting('t.pid')::uuid, null,
  '{"name_en": "Made Up Contact Removed By A Job"}') ->> 'id', true);
select api.contacts_remove(array[current_setting('t.mine')::uuid], 'made up: left');
select test.as_owner();
select audit.begin('job', 'made.up_clean_up', null, 'made up: a nightly clean-up');
update partner.contact set deleted_at = now(), deleted_by = core.system_person_id(), delete_reason = 'made up: a job'
where id = current_setting('t.job')::uuid;
select audit.end();

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.listed', api.recently_deleted(500)::text, true);
select test.as_owner();
select test.ok(exists (select 1 from jsonb_array_elements(current_setting('t.listed')::jsonb) x
                       where x ->> 'id' = current_setting('t.mine')), 'a person''s removal is listed');
select test.ok(not exists (select 1 from jsonb_array_elements(current_setting('t.listed')::jsonb) x
                           join audit.change c on c.row_id = (x ->> 'id')::uuid and c.action = 'remove'
                           join audit.request r on r.id = c.request_id and r.kind = 'system'),
  'what the system removed is not listed, even to an admin');
select test.ok(not exists (select 1 from jsonb_array_elements(current_setting('t.listed')::jsonb) x
                           where x ->> 'id' = current_setting('t.job')), 'nor what a job removed');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.restore(%L, %L)', 'role_capability', current_setting('t.sys')), 'P0001',
  'an admin cannot restore what the system removed', 'restore.system_removal');
select test.raises(format('select api.restore(%L, %L)', 'contact', current_setting('t.job')), 'P0001',
  'nor restore what a job removed', 'restore.system_removal');
select test.runs(format('select api.restore(%L, %L)', 'contact', current_setting('t.mine')),
  'a person''s removal is restored as before');
