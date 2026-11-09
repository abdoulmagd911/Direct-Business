-- CODE-02 — the code's configured discount value (FIX-04, F161): codes_detail answers fee_percent from the
-- latest code_terms row for the code's identifier, or null when there is no terms row (shown empty, never 0).
-- Every value is made up.
select set_config('t.creator', test.person('Test Codes Creator', 'head')::text, true);
select test.as_person(current_setting('t.creator')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Fee Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.p2', api.partner_create('{"trade_name_en": "Made Up No Fee Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'MADEUP15',
  'made up') ->> 'id', true);
select set_config('t.code2', api.identifier_add(current_setting('t.p2')::uuid, 'discount_code', 'MADEUPNONE',
  'made up') ->> 'id', true);
select test.ok((api.code_terms_add(current_setting('t.code')::uuid, null, 10.00,
  current_setting('t.creator')::uuid, '2026-10-01', '2026-10-01') ->> 'id') is not null,
  'an older terms row is added');
select test.ok((api.code_terms_add(current_setting('t.code')::uuid, null, 15.00,
  current_setting('t.creator')::uuid, '2026-11-01', '2026-11-01') ->> 'id') is not null,
  'and a newer one');

select test.eq((api.codes_detail(current_setting('t.code')::uuid) ->> 'fee_percent')::numeric, 15.00,
  'the latest terms row''s fee is the configured value');
select test.eq(api.codes_detail(current_setting('t.code2')::uuid) -> 'fee_percent', 'null'::jsonb,
  'a code with no terms row has no configured value — empty, never 0');
