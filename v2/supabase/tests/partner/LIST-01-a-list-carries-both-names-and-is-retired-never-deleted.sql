-- LIST-01 — setting lists (§3.0, V76, V133): a record type is a list only when its module declares it; each declared
-- list has a stable key and both names, and is edited on a settings page; every table shaped like a list is declared
-- (the access roles alone are not a list: api.role_save and its rules edit them — V132); everyone signed in reads the
-- lists; Full on that page adds and changes entries — both names required, the key fixed, an entry retired and never
-- deleted; each change logged and undoable; the list door refuses anything that is not a declared list.
-- Sabotage: supabase/tests/sabotage/view-changes-a-list.sql.
do $$
declare
  bad text;
begin
  select string_agg(e.key, ', ') into bad from core.entity e
  where e.active and e.is_list
    and (e.page_key not like 'settings.%'
         or (select count(*) from pg_attribute a where a.attrelid = to_regclass(e.table_name) and a.attnum > 0
             and not a.attisdropped and a.attnotnull and a.attname in ('key', 'name_en', 'name_ar', 'sort', 'active')) <> 5);
  perform test.ok(bad is null, format('declared lists without both required names or a settings page: %s', bad));
  select string_agg(format('%s.%s', n.nspname, c.relname), ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = any (test.v2_schemas())
    and (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
         and a.attname in ('key', 'name_en', 'name_ar', 'sort', 'active')) = 5
    and format('%s.%s', n.nspname, c.relname) <> 'core.role'
    and not exists (select 1 from core.entity e where e.table_name = format('%s.%s', n.nspname, c.relname) and e.is_list);
  perform test.ok(bad is null, format('tables shaped like a list but not declared one: %s', bad));
end $$;

select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.manager', test.person('Test Manager', 'manager')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);

select test.as_person(current_setting('t.viewer')::uuid);
select test.ok(jsonb_array_length(api.list('segment')) = 4, 'everyone reads the lists');
select test.as_person(current_setting('t.manager')::uuid);
select test.raises($$select api.list_save('segment', null, '{"key": "made_up", "name_en": "Made up", "name_ar": "متخيل"}')$$,
  '42501', 'a manager with View on Settings → Partners cannot change a list', 'access.needs_level');

select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.list_save('segment', null, '{"key": "made_up", "name_en": "Made up"}')$$, 'P0001',
  'the Arabic name is required', 'list.invalid');
select set_config('t.s', api.list_save('segment', null, '{"key": "made_up", "name_en": "Made up", "name_ar": "متخيل", "sort": 50}')
  ->> 'id', true);
select test.raises(format('select api.list_save(%L, %L, %L, 1)', 'segment', current_setting('t.s'), '{"key": "renamed"}'),
  'P0001', 'a key never changes', 'list.key_fixed');
select test.raises(format('select api.list_save(%L, %L, %L, 1)', 'segment', current_setting('t.s'), '{"colour": "red"}'),
  'P0001', 'a column the list does not have is refused', 'list.unknown_field');
select set_config('t.r', api.list_save('segment', current_setting('t.s')::uuid, '{"active": false}', 1) ->> 'request_id', true);
select test.eq(jsonb_array_length(api.list('segment')), 4, 'a retired entry leaves the list');
select test.eq(jsonb_array_length(api.list('segment', true)), 5, 'but is never deleted');
select api.undo(current_setting('t.r')::uuid);
select test.eq(jsonb_array_length(api.list('segment')), 5, 'and one Undo brings it back');
select test.ok((api.list_save('call_outcome', null, '{"key": "made_up_call", "name_en": "Made up", "name_ar": "متخيل",
  "counts_as_demo": true}') ->> 'id') is not null, 'a list with columns of its own saves them too');
select test.raises($$select api.list('no_such_list')$$, 'P0002', 'an unknown list', 'list.unknown');
select test.raises($$select api.list_save('role', null, '{"key": "made_up", "name_en": "Made up", "is_admin": true}')$$,
  'P0002', 'the access roles are no list: the list door refuses them', 'list.unknown');
