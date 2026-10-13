-- QA-47 — Restoring a removed record keeps that record type's own rules (V70, V26, V133): someone without
-- finance.credit_control brings back no credit limit, someone without clients.identify brings back no identifier,
-- and a partner never ends up with two live credit limits for one day. Written by the QA auditor to fail until it is
-- built: on v2/main at 5aeb683 core.restore asks only Full on the record's page, which every member holds on Partners.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-47. Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA47', 'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.admin')))), 'made up') ->> 'id', true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.cl1', api.credit_limit_set(current_setting('t.p')::uuid, 50000, core.riyadh_today(),
  current_setting('t.admin')::uuid, 'made up: first') ->> 'id', true);
select api.credit_limit_set(current_setting('t.p')::uuid, 0, core.riyadh_today(), current_setting('t.admin')::uuid,
  'made up: prepaid only');
select set_config('t.idn', api.identifier_add(current_setting('t.p')::uuid, 'vat', '300000000000013', 'made up')
  ->> 'id', true);
select api.identifier_remove(current_setting('t.idn')::uuid, 'made up: wrong VAT');

select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.restore(%L, %L, %L)', 'credit_limit', current_setting('t.cl1'), 'made up'),
  '42501', 'a member without finance.credit_control restores no credit limit');
select test.raises(format('select api.restore(%L, %L, %L)', 'identifier', current_setting('t.idn'), 'made up'),
  '42501', 'a member without clients.identify restores no identifier');
select test.as_owner();
select test.eq((select count(*)::int from partner.credit_limit where partner_id = current_setting('t.p')::uuid
                and deleted_at is null and effective_from = core.riyadh_today()), 1,
  'one live credit limit for the day');
