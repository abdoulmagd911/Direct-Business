-- NAME-01 — names (V77): the trade name (English and Arabic) and the official names are kept as name identifiers, one per
-- distinct key; a second partner with a name another holds is refused, naming it; renaming a partner removes the old
-- name identifier and adds the new one in the same request, so search follows, and one Undo takes it back. Made up.
-- Sabotage: supabase/tests/sabotage/a-rename-leaves-the-old-name.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.pid', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Tours', 'trade_name_ar', 'جولات متخيلة',
  'official_name_en', 'Made Up Tourism Holding LLC', 'official_name_ar', 'شركة جولات متخيلة',
  'sides', '[{"side": "client", "type": "corporate"}]'::jsonb)) ->> 'id', true);
select test.as_owner();
select test.eq((select array_agg(subkind order by subkind) from partner.identifier
                where partner_id = current_setting('t.pid')::uuid and kind = 'name' and deleted_at is null),
  array['official_en', 'trade_ar', 'trade_en'],
  'one name identifier per distinct key: the Arabic official name folds to the Arabic trade name');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises($$select api.partner_create('{"trade_name_en": "Made-Up Tours Co.", "sides": [{"side": "client", "type": "corporate"}]}')$$, '23505',
  'a partner whose name another holds is refused', 'identifier.held');
do $$
declare
  d text;
begin
  perform api.partner_create('{"trade_name_en": "MADE UP TOURS", "sides": [{"side": "client", "type": "corporate"}]}');
exception when unique_violation then
  get stacked diagnostics d = pg_exception_detail;
  perform set_config('t.detail', d, true);
end $$;
select test.ok(current_setting('t.detail') like 'DK-P-0001%Made Up Tours%', 'naming the partner that holds it');

select set_config('t.r', api.partner_update(current_setting('t.pid')::uuid, '{"trade_name_en": "Made Up Journeys"}', 1)
  ->> 'request_id', true);
select test.eq(api.search('made up journeys') -> 'partners' -> 0 ->> 'id', current_setting('t.pid'),
  'renamed, it is found by its new name');
select test.as_owner();
select test.eq((select count(*)::int from partner.identifier where partner_id = current_setting('t.pid')::uuid
                and kind = 'name' and value_key = 'madeuptours' and deleted_at is null), 0,
  'the old name identifier is removed');
select test.eq((select count(distinct request_id)::int from audit.change where request_id = current_setting('t.r')::uuid
                and table_name = 'partner.identifier'), 1, 'in the same request as the rename');
select test.as_person(current_setting('t.admin')::uuid);
select api.undo(current_setting('t.r')::uuid);
select test.eq(api.search('made up tours') -> 'partners' -> 0 ->> 'id', current_setting('t.pid'),
  'one Undo brings the old name back');
