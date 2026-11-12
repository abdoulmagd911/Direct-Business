-- SRCH-05 — search finds a discount code by its text (F-B1-01, Landing 15): a code typed in Ctrl-K answers
-- under 'codes' with its id, text and state; a fragment of the text finds it too; its holder organisation
-- still answers under 'partners', by name. A text no code carries finds none. The code is made by a head
-- (adding an identifier needs the identify capability); the search is read as a member, who sees Codes.
-- Every value is made up.
select set_config('t.creator', test.person('Test Codes Searcher', 'head')::text, true);
select set_config('t.reader', test.person('Test Codes Reader', 'member')::text, true);
select test.as_person(current_setting('t.creator')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Search Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'MADEUP10',
  'made up') ->> 'id', true);

select test.as_person(current_setting('t.reader')::uuid);
select test.eq((select x ->> 'id' from jsonb_array_elements(api.search('MADEUP10') -> 'codes') x),
  current_setting('t.code'), 'the code is found by its full text');
select test.eq((select x ->> 'code' from jsonb_array_elements(api.search('ADEUP1') -> 'codes') x),
  'MADEUP10', 'and by part of its text');
select test.eq((select x ->> 'state' from jsonb_array_elements(api.search('MADEUP10') -> 'codes') x),
  'active', 'with its state');
select test.eq((select x ->> 'id' from jsonb_array_elements(api.search('Made Up Search') -> 'partners') x),
  current_setting('t.p'), 'its holder still answers under partners, by name');
select test.eq(api.search('MADEUP99') -> 'codes', '[]'::jsonb, 'a text no code carries finds none');
