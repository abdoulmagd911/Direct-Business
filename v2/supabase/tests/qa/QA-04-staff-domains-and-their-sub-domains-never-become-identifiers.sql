-- QA-04 — Values that never become identifiers (V32): every address at directksa.com and directksa.net "and
-- sub-domains" is refused from the start, and a blocked domain blocks its sub-domains. Written by the QA auditor to fail
-- until it is built: on v2/main at 72577fa the block list starts empty and a domain block matches the exact domain only
-- (partner.identifier_insert: k like '%@' || value_key).
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-04. Made-up addresses only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA4'), 'made up')
  ->> 'id', true);

select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.p'), 'email',
  'test.qa4@directksa.com', 'made up'), 'P0001', 'a staff address (.com) is refused from the start', 'identifier.blocked');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.p'), 'email',
  'test.qa4@directksa.net', 'made up'), 'P0001', 'a staff address (.net) is refused from the start', 'identifier.blocked');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.p'), 'email',
  'test.qa4@mail.directksa.com', 'made up'), 'P0001', 'and so is one at a staff sub-domain', 'identifier.blocked');

select api.identifier_block_add('email', 'domain', 'example.org', 'made up: a test customer''s domain');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.p'), 'email',
  'test.qa4@sub.example.org', 'made up'), 'P0001', 'a blocked domain blocks its sub-domains', 'identifier.blocked');
