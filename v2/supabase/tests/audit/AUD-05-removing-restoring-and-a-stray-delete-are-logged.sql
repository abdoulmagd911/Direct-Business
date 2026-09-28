-- AUD-05 — setting deleted_at is logged as 'remove', clearing it as 'restore', and a stray DELETE (impossible through
-- the API, but a migration or psql could) is still logged with the row as it was (§3.3).
-- Sabotage: supabase/tests/sabotage/every-change-is-an-update.sql.
insert into core.department (code, name_en) values ('test_rm', 'Test Removal');
update core.department set deleted_at = now(), delete_reason = 'made up for a test' where code = 'test_rm';
update core.department set deleted_at = null, delete_reason = null where code = 'test_rm';
select set_config('t.dep', (select id from core.department where code = 'test_rm')::text, true);
delete from core.department where code = 'test_rm';
do $$
declare
  d uuid := current_setting('t.dep')::uuid;
  acts text[] := (select array_agg(action order by id) from audit.change where table_name = 'core.department' and row_id = d);
  last audit.change := test.last_change('core.department', d);
begin
  perform test.eq(acts, array['insert', 'remove', 'restore', 'delete'], 'the four actions, in order');
  perform test.eq(last.before ->> 'name_en', 'Test Removal', 'the deleted row is kept in the log');
  perform test.ok(last.after is null, 'a delete has no after');
end $$;
