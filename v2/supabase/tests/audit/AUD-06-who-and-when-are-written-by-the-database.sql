-- AUD-06 — who created or changed a row, when, and its version are written by the database from the request, never
-- taken from the caller: a supplied created_by or version is overwritten, and an update cannot rewrite them (A14).
-- Sabotage: supabase/tests/sabotage/stamp-trusts-the-caller.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.other', test.person('Test Other', 'member')::text, true);
select test.claims_of(current_setting('t.admin')::uuid);   -- as inside an api function called by them
select audit.begin('ui', 'role.saved');
insert into core.role (key, name_en, name_ar, created_by, version) values ('test_role', 'Test Role', 'دور للتجربة', current_setting('t.other')::uuid, 7);
update core.role set name_en = 'Test Role Two', created_by = current_setting('t.other')::uuid, version = 99 where key = 'test_role';
do $$
declare
  r core.role := (select r from core.role r where key = 'test_role');
begin
  perform test.eq(r.created_by, current_setting('t.admin')::uuid, 'created_by is the request''s person');
  perform test.eq(r.updated_by, current_setting('t.admin')::uuid, 'updated_by is the request''s person');
  perform test.eq(r.version, 2, 'the version counts updates, whatever the caller sent');
  perform test.ok(r.updated_at is not null, 'updated_at is set');
end $$;
