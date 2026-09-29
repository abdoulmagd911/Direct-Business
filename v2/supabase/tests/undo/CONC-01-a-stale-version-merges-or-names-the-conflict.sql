-- CONC-01 — a write names the version it read (A14): the same version passes; a stale version passes when nobody
-- changed the fields it writes since (the two edits merge), and is refused when someone did, naming the field, who and
-- when, and the version now; a write without a version, or to a record that is not there, is refused.
-- Sabotage: supabase/tests/sabotage/last-write-wins.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('conc_one')::text, true);
select set_config('t.v1', (select version::text from core.department where id = current_setting('t.dep')::uuid), true);

select test.act(current_setting('t.admin')::uuid);
update core.department set name_ar = 'اسم محفوظ' where id = current_setting('t.dep')::uuid;
select test.done();

select core.check_version('core.department', current_setting('t.dep')::uuid, current_setting('t.v1')::int,
  array['name_en']);
select test.raises(format('select core.check_version(%L, %L, %s, %L)', 'core.department', current_setting('t.dep'),
  current_setting('t.v1'), '{name_en,name_ar}'), '40001',
  'a stale version is refused when someone changed the same field since', 'common.conflict');
do $$
declare
  d text;
begin
  perform core.check_version('core.department', current_setting('t.dep')::uuid, current_setting('t.v1')::int,
                             array['name_ar']);
exception when serialization_failure then
  get stacked diagnostics d = pg_exception_detail;
  perform set_config('t.detail', d, true);
end $$;
select test.eq(current_setting('t.detail')::jsonb ->> 'field', 'name_ar', 'the conflict names the field');
select test.eq(current_setting('t.detail')::jsonb ->> 'by', current_setting('t.admin'), 'who changed it');
select test.ok(current_setting('t.detail')::jsonb ->> 'at' is not null, 'when');
select test.eq((current_setting('t.detail')::jsonb ->> 'version')::int,
  (select version from core.department where id = current_setting('t.dep')::uuid), 'and the version now');

select core.check_version('core.department', current_setting('t.dep')::uuid,
  (select version from core.department where id = current_setting('t.dep')::uuid), array['name_ar']);
select test.raises(format('select core.check_version(%L, %L, null, %L)', 'core.department', current_setting('t.dep'),
  '{name_en}'), 'P0001', 'a write must name the version it read', 'common.version_required');
select test.raises(format('select core.check_version(%L, %L, 1, %L)', 'core.department', gen_random_uuid(),
  '{name_en}'), 'P0002', 'a record that is not there', 'common.not_found');
