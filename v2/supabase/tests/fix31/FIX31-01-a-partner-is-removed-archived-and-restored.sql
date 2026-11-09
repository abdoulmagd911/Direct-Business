-- FIX31-01 — a partner is removed, archived and restored (FIX-31 F098, F103, F130). Remove is a soft delete with a
-- reason: the partner leaves every list, lands in Recently Deleted, and restores with its links intact. Archive is a
-- flag: the archived view shows only archived partners, the active list does not, and un-archive brings it back. A
-- viewer may do none of it. Every value is made up.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.c', api.partner_create('{"trade_name_en": "Made Up Client Co", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.s', api.partner_create('{"trade_name_en": "Made Up Supplier Co", "sides": [{"side": "supplier_partner", "type": "supplier"}]}') ->> 'id', true);

-- archive the client: it leaves the active list and is alone in the archived view
select test.runs(format('select api.partner_archive(%L, %L)', current_setting('t.c'), 'made up: no longer active'),
  'a manager archives a partner');
select test.eq((api.partners('{"side": "client"}') ->> 'total')::int, 0, 'the active list no longer shows it');
select test.eq((api.partners('{"side": "client", "archived_only": true}') ->> 'total')::int, 1,
  'the archived view shows only it');
select test.eq((api.partners('{"side": "client", "include_archived": true}') ->> 'total')::int, 1,
  'the mixed view still shows it');
select test.raises(format('select api.partner_archive(%L, %L)', current_setting('t.c'), 'again'), 'P0001',
  'archiving it twice is refused', 'partner.archived');

-- un-archive it: back in the active list, gone from the archived view
select test.runs(format('select api.partner_unarchive(%L, %L)', current_setting('t.c'), 'made up: active again'),
  'a manager un-archives it');
select test.eq((api.partners('{"side": "client"}') ->> 'total')::int, 1, 'the active list shows it again');
select test.eq((api.partners('{"side": "client", "archived_only": true}') ->> 'total')::int, 0,
  'the archived view is empty again');
select test.raises(format('select api.partner_unarchive(%L, %L)', current_setting('t.c'), 'again'), 'P0001',
  'un-archiving a live partner is refused', 'partner.not_archived');

-- remove the supplier: it leaves every list, lands in Recently Deleted, and restores
select test.runs(format('select api.partner_remove(%L, %L)', current_setting('t.s'), 'made up: duplicate record'),
  'a manager removes a partner with a reason');
select test.eq((api.partners('{"side": "supplier_partner"}') ->> 'total')::int, 0, 'the supplier list is empty');
select test.raises(format('select api.partner(%L)', current_setting('t.s')), 'P0002',
  'the record itself is gone', 'common.not_found');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(api.recently_deleted())
                where value ->> 'id' = current_setting('t.s')), 1, 'it sits in Recently Deleted');
select test.runs(format('select api.restore(%L, %L, %L)', 'partner', current_setting('t.s'), 'made up: kept after all'),
  'and restores from there');
select test.eq((api.partners('{"side": "supplier_partner"}') ->> 'total')::int, 1, 'the supplier list shows it again');
select test.eq(api.partner(current_setting('t.s')::uuid) ->> 'trade_name_en', 'Made Up Supplier Co',
  'the record reads again');

-- a viewer may do none of it
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.partner_archive(%L, %L)', current_setting('t.c'), 'no'), '42501',
  'a viewer archives nothing', 'access.needs_level');
select test.raises(format('select api.partner_remove(%L, %L)', current_setting('t.c'), 'no'), '42501',
  'a viewer removes nothing', 'access.needs_level');
