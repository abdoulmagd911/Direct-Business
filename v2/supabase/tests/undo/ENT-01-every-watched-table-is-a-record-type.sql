-- ENT-01 — every watched table is a record type, and every record type a watched table (V127): the registry names each
-- table the change log watches, with the page whose Full undoes any change to it and the people who own a row; a
-- row's owners are found; a record type naming a table or owners that do not exist is refused.
-- Sabotage: supabase/tests/sabotage/a-watched-table-that-is-no-record-type.sql.
do $$
begin
  perform test.eq(
    (select array_agg(w order by w collate "C")
     from (select distinct c.relnamespace::regnamespace::text || '.' || c.relname as w
           from pg_trigger t join pg_class c on c.oid = t.tgrelid
           where t.tgfoid = 'audit.capture'::regproc and not t.tgisinternal) watched),
    (select array_agg(table_name order by table_name collate "C") from core.entity where active),
    'every watched table is a record type and every record type a watched table');
end $$;

select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.dep', test.department('entity_one')::text, true);
update core.department set head_person_id = current_setting('t.head')::uuid where id = current_setting('t.dep')::uuid;
select test.eq(core.owners_of('core.department', current_setting('t.dep')::uuid),
  array[current_setting('t.head')::uuid], 'a department is owned by its head');
select test.eq(core.owners_of('core.person', current_setting('t.am1')::uuid),
  array[current_setting('t.am1')::uuid], 'a person owns their own record');
select test.eq(core.owners_of('core.role', (select id from core.role where key = 'member')), '{}'::uuid[],
  'a role has no owner');

select test.raises($$insert into core.entity (key, table_name, page_key, owners)
                     values ('made_up', 'core.made_up', null, null)$$,
  'P0001', 'a record type naming no table is refused', 'entity.unknown_table');
select test.raises($$insert into core.entity (key, table_name, page_key, owners)
                     values ('made_up', 'core.wording', null, 'no_such_column')$$,
  'P0001', 'owners that are neither a column nor a function are refused', 'entity.bad_owners');
