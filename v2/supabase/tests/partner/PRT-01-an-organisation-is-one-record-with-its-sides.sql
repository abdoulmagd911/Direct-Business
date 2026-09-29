-- PRT-01 — one record per organisation, with its sides (§3.4, V52, V98, V134): Full on a side's page adds an
-- organisation with that side on — a number from partner.id_format, the side with its type and owner, in one request;
-- the other side is switched on later with its own type and fields, each field checked (required, typed, select
-- options, no unknown ones); a side is switched off from a day and keeps everything, but the last side stays on;
-- changes name the version read; an archived organisation is read-only; View cannot add. Every value is made up.
-- Sabotage: supabase/tests/sabotage/side-fields-go-unchecked.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.side_field_save(null, '{"side": "supplier_partner", "key": "stage", "label_en": "Stage", "label_ar": "المرحلة",
  "type": "select", "required": true, "options": [{"key": "negotiating", "en": "Negotiating", "ar": "تفاوض"},
  {"key": "live", "en": "Live", "ar": "فعّال"}]}');
select api.side_field_save(null, '{"side": "supplier_partner", "key": "rooms", "label_en": "Rooms a year",
  "label_ar": "الغرف سنوياً", "type": "number"}');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Travel', 'trade_name_ar', 'رحلات متخيلة',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))),
  'made up: new client')::text, true);
select test.eq(current_setting('t.p')::jsonb ->> 'number', 'DK-P-0001', 'a new organisation is numbered from partner.id_format');
select test.as_owner();
select set_config('t.pid', current_setting('t.p')::jsonb ->> 'id', true);
select test.eq((select count(distinct c.request_id)::int from audit.change c where c.row_id = current_setting('t.pid')::uuid
                or c.row_id in (select id from partner.partner_side where partner_id = current_setting('t.pid')::uuid)
                or c.row_id in (select id from partner.side_owner where partner_id = current_setting('t.pid')::uuid)), 1,
  'the organisation, its side and the side''s owner in one request');
select test.eq((select array_agg(x) from partner.owners(current_setting('t.pid')::uuid) x),
  array[current_setting('t.am1')::uuid], 'a person may make themselves the owner');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_create(%L)', jsonb_build_object('trade_name_en', 'Made Up Other',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.admin'))))),
  '42501', 'making someone else the owner needs clients.assign', 'access.needs_capability');
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Sideless"}')$$, 'P0001',
  'an organisation starts with a side on', 'partner.side_required');
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Typeless", "sides": [{"side": "client"}]}')$$,
  'P0001', 'a side needs its type', 'partner.side_type_required');
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Mixed", "sides": [{"side": "client", "type": "supplier"}]}')$$,
  'P0002', 'a type from the other side''s list is no type of this one', 'partner.unknown_side_entry');
select test.raises($$select api.partner_create('{"trade_name_en": " ", "sides": [{"side": "client", "type": "corporate"}]}')$$,
  'P0001', 'a trade name is required', 'partner.trade_name_required');
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Vat", "vat": "300", "sides": [{"side": "client", "type": "corporate"}]}')$$,
  'P0001', 'a VAT number is an identifier, never an organisation column', 'partner.unknown_field');

select test.raises(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.pid'), 'supplier_partner',
  '{"type": "strategic_partner", "fields": {"rooms": 10}}'), 'P0001', 'a required side field is required',
  'partner.side_field_required');
select test.raises(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.pid'), 'supplier_partner',
  '{"type": "strategic_partner", "fields": {"stage": "signed"}}'), 'P0001', 'a select field takes one of its options',
  'partner.side_field_invalid');
select test.raises(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.pid'), 'supplier_partner',
  '{"type": "strategic_partner", "fields": {"stage": "live", "rooms": "many"}}'), 'P0001', 'a number field takes a number',
  'partner.side_field_invalid');
select test.raises(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.pid'), 'supplier_partner',
  '{"type": "strategic_partner", "fields": {"stage": "live", "colour": "blue"}}'), 'P0001',
  'a field the side does not have is refused', 'partner.unknown_side_field');
select api.partner_side_set(current_setting('t.pid')::uuid, 'supplier_partner',
  '{"type": "strategic_partner", "fields": {"stage": "live", "rooms": 120}}');
select test.eq((select jsonb_agg(jsonb_build_object('side', s ->> 'side', 'type', s ->> 'type', 'on', s -> 'on') order by s ->> 'side')
                from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'sides') s),
  '[{"side": "client", "type": "corporate", "on": true}, {"side": "supplier_partner", "type": "strategic_partner", "on": true}]'::jsonb,
  'an organisation has both sides on, each with its own type');

select api.partner_side_off(current_setting('t.pid')::uuid, 'client', null, 'made up: no longer buys');
select test.eq((select jsonb_agg(s ->> 'side') from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'sides') s
                where (s -> 'on')::boolean), '["supplier_partner"]'::jsonb, 'a side switched off');
select test.as_owner();
select test.eq((select count(*)::int from partner.partner_side where partner_id = current_setting('t.pid')::uuid
                and deleted_at is null), 2, 'keeps its row');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_side_off(%L, %L)', current_setting('t.pid'), 'supplier_partner'), 'P0001',
  'the last side stays on', 'partner.last_side');
select api.partner_side_set(current_setting('t.pid')::uuid, 'client', '{}');
select test.eq((select count(*)::int from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'sides') s
                where (s -> 'on')::boolean and s ->> 'type' = 'corporate'), 1, 'and is switched on again as it was');

select api.partner_update(current_setting('t.pid')::uuid, '{"city": "Made-up City"}', 1);
select test.raises(format('select api.partner_update(%L, %L, 1)', current_setting('t.pid'), '{"city": "From a stale screen"}'),
  '40001', 'a change from a stale screen is refused', 'common.conflict');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Viewer", "sides": [{"side": "client", "type": "corporate"}]}')$$,
  '42501', 'View on Clients cannot add an organisation', 'access.needs_level');
select test.ok((api.partner(current_setting('t.pid')::uuid) ->> 'number') = 'DK-P-0001', 'but reads it');

select test.as_owner();
update partner.partner set archived_at = now() where id = current_setting('t.pid')::uuid;
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_update(%L, %L, 2)', current_setting('t.pid'), '{"city": "Elsewhere"}'),
  'P0001', 'an archived organisation is read-only', 'partner.archived');
