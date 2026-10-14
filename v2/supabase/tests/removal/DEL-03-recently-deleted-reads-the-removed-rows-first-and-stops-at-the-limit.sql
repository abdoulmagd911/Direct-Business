-- DEL-03 — Recently deleted is fast (QA3-007): it looks at the removed rows only, newest first, asks "may this person
-- see it?" of each one at a time and stops at the limit — never of the live rows, never past the limit — and every
-- record type that can be removed has an index on when it was removed. The count of may-see questions is the proof, not
-- a clock, so it fails the same on any machine. Made up.
-- Sabotages: supabase/tests/sabotage/recently-deleted-checks-every-row.sql,
--            supabase/tests/sabotage/recently-deleted-reads-past-the-limit.sql,
--            supabase/tests/sabotage/a-removable-record-type-has-no-removal-index.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);

-- every record type that can be removed has an index on when it was removed (a small one, holding removed rows only)
select test.eq((select coalesce(pg_catalog.string_agg(x.table_name, ', ' order by x.table_name), '') from core.entity x
                where x.active
                  and exists (select 1 from pg_attribute a where a.attrelid = to_regclass(x.table_name)
                              and a.attname = 'deleted_at' and not a.attisdropped)
                  and not exists (select 1 from pg_index i where i.indrelid = to_regclass(x.table_name)
                                  and i.indpred is not null
                                  and (select a.attname from pg_attribute a
                                       where a.attrelid = i.indrelid and a.attnum = i.indkey[0]) = 'deleted_at')),
  '', 'every record type that can be removed has an index on when it was removed');

-- many live rows, a few removed ones: one person's partners and contacts
select test.as_person(current_setting('t.am1')::uuid);
select api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Live Partner ' || i,
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
  'owner_id', current_setting('t.am1'))))) from generate_series(1, 8) i;
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Removal Speed',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
  'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.ids', (select pg_catalog.string_agg(api.contact_save(current_setting('t.pid')::uuid, null,
  jsonb_build_object('name_en', 'Made Up Contact ' || i, 'is_primary', i = 1)) ->> 'id', ',' order by i)
  from generate_series(1, 6) i), true);
select api.contacts_remove(array[(string_to_array(current_setting('t.ids'), ','))[2]::uuid,
                                 (string_to_array(current_setting('t.ids'), ','))[3]::uuid,
                                 (string_to_array(current_setting('t.ids'), ','))[4]::uuid,
                                 (string_to_array(current_setting('t.ids'), ','))[5]::uuid], 'made up: left');

-- count every may-see question (the original keeps its name, a counting stand-in takes the old one's place)
select test.as_owner();
alter function authz.can_see_as(uuid, text, uuid) rename to can_see_as_counted;
create function authz.can_see_as(p_person uuid, p_table text, p_id uuid) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform pg_catalog.set_config('made_up.can_see_calls',
    (coalesce(nullif(pg_catalog.current_setting('made_up.can_see_calls', true), ''), '0')::int + 1)::text, true);
  return authz.can_see_as_counted(p_person, p_table, p_id);
end
$$;

select test.as_person(current_setting('t.am1')::uuid);
select set_config('made_up.can_see_calls', '0', true);
select test.eq((select pg_catalog.count(*) from jsonb_array_elements(api.recently_deleted(200)) x
                where x ->> 'id' = any (string_to_array(current_setting('t.ids'), ','))), 4::bigint,
  'the four removed contacts are listed');
select test.eq(current_setting('made_up.can_see_calls')::int, 4,
  'Recently deleted asks may-see of the removed rows only, not of the live ones');

select set_config('made_up.can_see_calls', '0', true);
select test.eq(jsonb_array_length(api.recently_deleted(2)), 2, 'a limit of two lists two');
select test.eq(current_setting('made_up.can_see_calls')::int, 2,
  'Recently deleted stops asking at the limit');
