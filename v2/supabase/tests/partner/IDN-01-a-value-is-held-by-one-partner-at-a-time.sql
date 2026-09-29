-- IDN-01 — identifiers (§3.5, V133): a value is held by one partner at a time — whatever spelling it is typed in — and
-- adding it to a second is refused, naming the holder; it is never rewritten or moved: removed from one and added to
-- the other; its Undo puts it back only while nobody else holds it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/two-partners-hold-one-phone.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create('{"trade_name_en": "Made Up Alpha"}') ->> 'id', true);
select set_config('t.b', api.partner_create('{"trade_name_en": "Made Up Beta"}') ->> 'id', true);

select set_config('t.i1', api.identifier_add(current_setting('t.a')::uuid, 'phone', '+966 50 000 0001', 'made up: from a form')
  ->> 'id', true);
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.b'), 'phone', '0966500000001',
  'made up'), '23505', 'the same phone in another spelling is refused to a second partner', 'identifier.held');
do $$
declare
  d text;
begin
  perform api.identifier_add(current_setting('t.b')::uuid, 'phone', '٠٥٠٠٠٠٠٠٠١', 'made up');
exception when unique_violation then
  get stacked diagnostics d = pg_exception_detail;
  perform set_config('t.detail', d, true);
end $$;
select test.ok(current_setting('t.detail') like '%Made Up Alpha%', 'naming the partner that holds it');
select api.identifier_add(current_setting('t.a')::uuid, 'payments_client_id', 'C-00042', 'made up', 'postpaid');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.b'), 'payments_client_id', '42',
  'made up'), '23505', 'a client ID is one key without its leading zeros', 'identifier.held');

select test.as_owner();
select test.raises(format('update partner.identifier set partner_id = %L where id = %L', current_setting('t.b'),
  current_setting('t.i1')), 'P0001', 'an identifier is never moved in place', 'identifier.never_rewritten');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.rm', api.identifier_remove(current_setting('t.i1')::uuid, 'made up: belongs to Beta') ->> 'request_id', true);
select api.identifier_add(current_setting('t.b')::uuid, 'phone', '0500000001', 'made up: the right partner');
select test.raises(format('select api.undo(%L)', current_setting('t.rm')), '23505',
  'the removal is not undone while another partner holds the value', 'undo.blocked_by_duplicate');
select test.eq(api.search('0500000001') -> 'partners' -> 0 ->> 'id', current_setting('t.b'), 'search finds its holder');
