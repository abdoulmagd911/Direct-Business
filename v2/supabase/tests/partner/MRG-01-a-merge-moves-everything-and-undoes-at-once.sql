-- MRG-01 — merging two records of one organisation (V136): partners.merge; the merged partner's identifiers move to the
-- kept one (its names become aliases), the roles the kept one lacks are added, its contacts move; the merged one keeps
-- its history, is archived and points at the kept one; one request, so one Undo takes it all back. Made up.
-- Sabotage: supabase/tests/sabotage/a-merge-leaves-the-identifiers.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.manager', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.kept', api.partner_create('{"trade_name_en": "Made Up Kept", "roles": ["client"]}') ->> 'id', true);
select set_config('t.gone', api.partner_create('{"trade_name_en": "Made Up Duplicate", "roles": ["supplier"]}') ->> 'id', true);
select api.identifier_add(current_setting('t.gone')::uuid, 'email', 'orders@example.test', 'made up');
select api.contact_save(current_setting('t.gone')::uuid, null, '{"name_en": "Made Up Contact", "is_primary": true}');

select test.as_person(current_setting('t.manager')::uuid);
select test.raises(format('select api.partner_merge(%L, %L, %L)', current_setting('t.kept'), current_setting('t.gone'), 'made up'),
  '42501', 'merging needs partners.merge', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.partner_merge(current_setting('t.kept')::uuid, current_setting('t.gone')::uuid,
  'made up: the same company twice') ->> 'request_id', true);
select set_config('t.card', api.partner(current_setting('t.kept')::uuid)::text, true);
select test.ok(exists (select 1 from jsonb_array_elements(current_setting('t.card')::jsonb -> 'identifiers') i
                       where i ->> 'value' = 'orders@example.test' and i ->> 'source' = 'merge'),
  'the merged partner''s identifiers move to the kept one');
select test.ok(exists (select 1 from jsonb_array_elements(current_setting('t.card')::jsonb -> 'identifiers') i
                       where i ->> 'value' = 'Made Up Duplicate' and i ->> 'subkind' = 'alias'), 'its names as aliases');
select test.eq((select jsonb_agg(r ->> 'role' order by r ->> 'role') from jsonb_array_elements(current_setting('t.card')::jsonb -> 'roles') r),
  '["client", "supplier"]'::jsonb, 'the roles it lacked are added');
select test.eq(jsonb_array_length(current_setting('t.card')::jsonb -> 'contacts'), 1, 'the contacts move');
select test.eq(api.search('made up duplicate') -> 'partners' -> 0 ->> 'id', current_setting('t.kept'),
  'the old name finds the kept partner');
select test.eq((api.partner(current_setting('t.gone')::uuid) ->> 'merged_into_id'), current_setting('t.kept'),
  'the merged one is archived, pointing at the kept one');
select test.raises(format('select api.partner_update(%L, %L, 2)', current_setting('t.gone'), '{"city": "Elsewhere"}'), 'P0001',
  'and read-only', 'partner.archived');

select api.undo(current_setting('t.r')::uuid);
select test.eq((api.partner(current_setting('t.gone')::uuid) ->> 'archived_at'), null::text, 'one Undo takes it all back');
select test.eq(api.search('orders@example.test') -> 'partners' -> 0 ->> 'id', current_setting('t.gone'),
  'the identifiers are back where they were');
select test.eq(jsonb_array_length(api.partner(current_setting('t.kept')::uuid) -> 'roles'), 1, 'and the roles');
