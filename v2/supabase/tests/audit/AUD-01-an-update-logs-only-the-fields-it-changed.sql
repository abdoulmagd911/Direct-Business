-- AUD-01 — an update is logged as one change holding only the fields it changed, before and after, with the row's new
-- version (§3.3, A16).
-- Sabotage: supabase/tests/sabotage/capture-logs-the-whole-row.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.claims_of(current_setting('t.admin')::uuid);   -- as inside an api function called by them
select audit.begin('ui', 'department.saved');
insert into core.department (code, name_en, name_ar) values ('test_sales', 'Test Sales', 'مبيعات تجريبية');
update core.department set name_en = 'Test Sales Team' where code = 'test_sales';
select audit.end();
do $$
declare
  c audit.change;
  d uuid := (select id from core.department where code = 'test_sales');
begin
  c := test.last_change('core.department', d);
  perform test.eq(c.action, 'update', 'the second write is an update');
  perform test.eq(c.fields, array['name_en'], 'only the changed field is named');
  perform test.eq(c.before, '{"name_en": "Test Sales"}'::jsonb, 'before holds only the changed field');
  perform test.eq(c.after, '{"name_en": "Test Sales Team"}'::jsonb, 'after holds only the changed field');
  perform test.eq(c.version_after, 2, 'the version after the update');
  perform test.eq((select count(*) from audit.change where table_name = 'core.department' and row_id = d)::int, 2,
    'one change for the insert, one for the update');
end $$;
