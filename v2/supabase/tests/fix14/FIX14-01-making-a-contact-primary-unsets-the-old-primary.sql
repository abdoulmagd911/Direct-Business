-- FIX14-01 — making a contact primary unsets the old primary (FIX-14 F114). The Primary switch used to hit the
-- contact_one_primary index and fail; now the save unsets the partner's other primary contacts in the same request,
-- so the switch succeeds and exactly one contact stays primary — on an update and on a new contact. Every value is
-- made up.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Primary Co", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.a', api.contact_save(current_setting('t.p')::uuid, null,
  '{"name_en": "Made Up First", "is_primary": true}') ->> 'id', true);
select set_config('t.b', api.contact_save(current_setting('t.p')::uuid, null,
  '{"name_en": "Made Up Second"}') ->> 'id', true);

-- the switch: the second contact becomes primary, the first stops being primary
select set_config('t.v', (select (c ->> 'version')::text from pg_catalog.jsonb_array_elements(
  api.partner(current_setting('t.p')::uuid) -> 'contacts') c where c ->> 'id' = current_setting('t.b')), true);
select test.runs(format('select api.contact_save(%L, %L, %L, %s)', current_setting('t.p'), current_setting('t.b'),
  '{"is_primary": true}', current_setting('t.v')), 'making the second contact primary saves');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(
  api.partner(current_setting('t.p')::uuid) -> 'contacts') c where (c ->> 'is_primary')::boolean), 1,
  'exactly one contact is primary');
select test.eq((select c ->> 'is_primary' from pg_catalog.jsonb_array_elements(
  api.partner(current_setting('t.p')::uuid) -> 'contacts') c where c ->> 'id' = current_setting('t.a')), 'false',
  'the first contact is no longer primary');
select test.eq((select c ->> 'is_primary' from pg_catalog.jsonb_array_elements(
  api.partner(current_setting('t.p')::uuid) -> 'contacts') c where c ->> 'id' = current_setting('t.b')), 'true',
  'the second contact is primary');

-- a new primary contact unsets the current one too
select set_config('t.c', api.contact_save(current_setting('t.p')::uuid, null,
  '{"name_en": "Made Up Third", "is_primary": true}') ->> 'id', true);
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(
  api.partner(current_setting('t.p')::uuid) -> 'contacts') c where (c ->> 'is_primary')::boolean), 1,
  'still exactly one primary after adding a third');
select test.eq((select c ->> 'is_primary' from pg_catalog.jsonb_array_elements(
  api.partner(current_setting('t.p')::uuid) -> 'contacts') c where c ->> 'id' = current_setting('t.b')), 'false',
  'the second contact is no longer primary');
