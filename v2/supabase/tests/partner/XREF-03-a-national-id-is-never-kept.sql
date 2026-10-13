-- XREF-03 — no national ID is ever kept (OLD-033, V428): a national ID, a residence permit (iqama) or a civil ID named
-- as such is refused like a password, in English and in Arabic; a bare registration number and a hotel stay are not.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-national-id-is-kept.sql.
select test.ok(core.looks_secret('National ID 1000000001'), 'a national ID');
select test.ok(core.looks_secret('iqama: 2000000002'), 'an iqama');
select test.ok(core.looks_secret('civil id 1000000003'), 'a civil ID');
select test.ok(core.looks_secret('رقم الهوية 1000000004'), 'رقم الهوية');
select test.ok(core.looks_secret('الهوية الوطنية: 1000000005'), 'الهوية الوطنية');
select test.ok(core.looks_secret('رقم الإقامة 2000000006'), 'رقم الإقامة');
select test.ok(not core.looks_secret('1010000007'), 'a bare ten-digit number may be a commercial registration');
select test.ok(not core.looks_secret('إقامة فندقية'), 'a hotel stay is no residence permit');
select test.ok(not core.looks_secret('made.up.agent'), 'a username is kept');

select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Signatory Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'),
  '{"system": "ticket", "value": "signatory national ID 1000000008"}'), 'P0001',
  'a reference that holds a national ID is refused', 'partner.no_secrets');
