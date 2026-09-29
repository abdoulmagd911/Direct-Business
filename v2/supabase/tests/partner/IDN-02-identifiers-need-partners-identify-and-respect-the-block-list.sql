-- IDN-02 — who adds identifiers, and what can never be one (§3.5, V133): adding or removing needs partners.identify
-- (moving money between people); the four names follow the partner's name fields — only an alias is added here;
-- values on the block list (an exact value, or every email of a domain) are refused with the list's reason; a value
-- with no key left is refused; individuals are listed apart and never hold a partner's name. Made up.
-- Sabotage: supabase/tests/sabotage/the-block-list-blocks-nothing.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create('{"trade_name_en": "Made Up Gamma"}') ->> 'id', true);
select api.identifier_block_add('email', 'domain', 'staff.example.test', 'made up: our own staff');
select api.identifier_block_add('vat', 'exact', '300000000000013', 'made up: the test VAT');

select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.a'), 'email',
  'someone@STAFF.example.test', 'made up'), 'P0001', 'an email of a blocked domain is refused', 'identifier.blocked');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.a'), 'vat', '300 0000 0000 0013',
  'made up'), 'P0001', 'a blocked value is refused in any spelling', 'identifier.blocked');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.a'), 'phone', '123', 'made up'),
  'P0001', 'a value with no key left is refused', 'identifier.empty_key');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, %L)', current_setting('t.a'), 'name', 'Made Up G',
  'made up', 'trade_en'), 'P0001', 'the four names follow the partner fields', 'identifier.name_follows_partner');
select test.ok((api.identifier_add(current_setting('t.a')::uuid, 'name', 'Made Up G', 'made up: short form', 'alias')
  ->> 'id') is not null, 'an alias is added here');
select test.raises(format('select api.identifier_add(%L, %L, %L, null)', current_setting('t.a'), 'email', 'buyer@example.test'),
  'P0001', 'an identifier needs a reason', 'common.reason_required');

select test.raises($$select api.individual_add('Made Up Gamma')$$, '23505',
  'a name a partner holds is not an individual''s', 'identifier.held');
select test.ok((api.individual_add('Made Up Person Name', 'made up: a traveller') ->> 'id') is not null,
  'an individual is listed apart');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.a'), 'email', 'buyer@example.test',
  'made up'), '42501', 'a member without partners.identify cannot add an identifier', 'access.needs_capability');
