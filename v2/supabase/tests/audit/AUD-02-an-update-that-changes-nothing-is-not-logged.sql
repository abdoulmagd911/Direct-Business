-- AUD-02 — an update that changes nothing a person can see is not logged and does not bump the version (§3.3).
-- Sabotage: supabase/tests/sabotage/capture-logs-no-op-updates.sql.
insert into core.department (code, name_en) values ('test_ops', 'Test Ops');
update core.department set name_en = name_en, updated_at = now() + interval '1 day' where code = 'test_ops';
do $$
declare
  d core.department := (select d from core.department d where code = 'test_ops');
begin
  perform test.eq((select count(*) from audit.change where table_name = 'core.department' and row_id = d.id)::int, 1,
    'only the insert is logged');
  perform test.eq(d.version, 1, 'the version did not move');
  perform test.ok(d.updated_at is null, 'the bookkeeping did not move either');
end $$;
