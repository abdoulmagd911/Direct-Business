-- PRT-01 — one record per organisation with its roles (§3.4, V52, V62, V134): Full on Partners adds a partner — a number
-- from partner.id_format, its roles and account manager in one request; each role's own fields are checked (required,
-- typed, select options); setting the roles removes the ones left out; changes name the version read; an archived
-- partner is read-only; View cannot add. Every value is made up.
-- Sabotage: supabase/tests/sabotage/role-fields-go-unchecked.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
insert into partner.role_field (role_id, key, label_en, label_ar, type, required, options)
select id, 'stage', 'Stage', 'المرحلة', 'select', true,
       '[{"key": "negotiating", "en": "Negotiating", "ar": "تفاوض"}, {"key": "live", "en": "Live", "ar": "فعّال"}]'
from partner.role where key = 'strategic_partner';
insert into partner.role_field (role_id, key, label_en, label_ar, type)
select id, 'rooms', 'Rooms a year', 'الغرف سنوياً', 'number' from partner.role where key = 'strategic_partner';

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Travel', 'trade_name_ar', 'رحلات متخيلة',
  'roles', '["client"]'::jsonb, 'account_manager_id', current_setting('t.am1')), 'made up: new client')::text, true);
select test.eq(current_setting('t.p')::jsonb ->> 'number', 'DK-P-0001', 'a new partner is numbered from partner.id_format');
select test.as_owner();
select set_config('t.pid', current_setting('t.p')::jsonb ->> 'id', true);
select test.eq((select count(distinct c.request_id)::int from audit.change c where c.row_id = current_setting('t.pid')::uuid
                or c.row_id in (select id from partner.partner_role where partner_id = current_setting('t.pid')::uuid)
                or c.row_id in (select id from partner.account_manager where partner_id = current_setting('t.pid')::uuid)), 1,
  'the partner, its role and its account manager in one request');
select test.eq((select array_agg(x) from partner.owners(current_setting('t.pid')::uuid) x),
  array[current_setting('t.am1')::uuid], 'a person may make themselves its account manager');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_create(%L)', jsonb_build_object('trade_name_en', 'Made Up Other',
  'account_manager_id', current_setting('t.admin'))), '42501',
  'making someone else the account manager needs partners.assign', 'access.needs_capability');
select test.raises($$select api.partner_create('{"trade_name_en": " "}')$$, 'P0001', 'a trade name is required',
  'partner.trade_name_required');
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Vat", "vat": "300"}')$$, 'P0001',
  'a VAT number is an identifier, never a partner column', 'partner.unknown_field');

select test.raises(format('select api.partner_roles_set(%L, %L)', current_setting('t.pid'),
  '[{"role": "strategic_partner", "fields": {"rooms": 10}}]'), 'P0001', 'a required role field is required',
  'partner.role_field_required');
select test.raises(format('select api.partner_roles_set(%L, %L)', current_setting('t.pid'),
  '[{"role": "strategic_partner", "fields": {"stage": "signed"}}]'), 'P0001', 'a select field takes one of its options',
  'partner.role_field_invalid');
select test.raises(format('select api.partner_roles_set(%L, %L)', current_setting('t.pid'),
  '[{"role": "strategic_partner", "fields": {"stage": "live", "rooms": "many"}}]'), 'P0001', 'a number field takes a number',
  'partner.role_field_invalid');
select test.raises(format('select api.partner_roles_set(%L, %L)', current_setting('t.pid'),
  '[{"role": "strategic_partner", "fields": {"stage": "live", "colour": "blue"}}]'), 'P0001',
  'a field the role does not have is refused', 'partner.unknown_role_field');
select api.partner_roles_set(current_setting('t.pid')::uuid,
  '[{"role": "client"}, {"role": "strategic_partner", "subkind": "integration", "fields": {"stage": "live", "rooms": 120}}]');
select test.eq((select jsonb_agg(r ->> 'role' order by r ->> 'role') from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'roles') r),
  '["client", "strategic_partner"]'::jsonb, 'a partner holds any number of roles');
select api.partner_roles_set(current_setting('t.pid')::uuid, '[{"role": "strategic_partner", "fields": {"stage": "negotiating"}}]');
select test.eq((select jsonb_agg(r ->> 'role') from jsonb_array_elements(api.partner(current_setting('t.pid')::uuid) -> 'roles') r),
  '["strategic_partner"]'::jsonb, 'setting the roles removes the ones left out');

select api.partner_update(current_setting('t.pid')::uuid, '{"city": "Made-up City"}', 1);
select test.raises(format('select api.partner_update(%L, %L, 1)', current_setting('t.pid'), '{"city": "From a stale screen"}'),
  '40001', 'a change from a stale screen is refused', 'common.conflict');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises($$select api.partner_create('{"trade_name_en": "Made Up Viewer"}')$$, '42501',
  'View on Partners cannot add a partner', 'access.needs_level');
select test.ok((api.partner(current_setting('t.pid')::uuid) ->> 'number') = 'DK-P-0001', 'but reads it');

select test.as_owner();
update partner.partner set archived_at = now() where id = current_setting('t.pid')::uuid;
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.partner_update(%L, %L, 2)', current_setting('t.pid'), '{"city": "Elsewhere"}'),
  'P0001', 'an archived partner is read-only', 'partner.archived');
