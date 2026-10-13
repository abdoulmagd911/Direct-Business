-- PIPE-05 — bulk assign (V472, V456): five opportunities given to one owner in one request, five notices — one per card
-- — and one Undo reverting all; pipeline.assign is needed; a card the owner already holds is left alone; an
-- organisation's card shows its tenders and opportunities on its Work tab. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-bulk-assign-tells-nobody.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test First Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test New Owner', 'member')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Many Leads Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.ids', (select jsonb_agg(api.opportunity_save(null, jsonb_build_object('title', 'Made-up lead ' || n,
  'partner_id', current_setting('t.p'), 'side', 'client', 'type', 'corporate', 'source', 'event')) -> 'id')
  from generate_series(1, 5) n)::text, true);
select set_config('t.t', api.tender_save(null, jsonb_build_object('title', 'Made-up tender',
  'partner_id', current_setting('t.p'), 'source', 'tender_portal')) ->> 'id', true);
select test.raises(format('select api.opportunity_bulk_assign(%L::uuid[], %L)',
  (select array_agg(x::uuid) from jsonb_array_elements_text(current_setting('t.ids')::jsonb) x), current_setting('t.am2')),
  '42501', 'a member gives no cards away', 'access.needs_capability');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.opportunity_bulk_assign(
  (select array_agg(x::uuid) from jsonb_array_elements_text(current_setting('t.ids')::jsonb) x),
  current_setting('t.am2')::uuid, 'made up: territories')::text, true);
select test.eq((current_setting('t.r')::jsonb ->> 'count')::int, 5, 'five cards change hands');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'assigned' and request_id = (current_setting('t.r')::jsonb ->> 'request_id')::uuid), 5,
  'one request, a notice per card');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.opportunity_bulk_assign((select array_agg(x::uuid)
  from jsonb_array_elements_text(current_setting('t.ids')::jsonb) x), current_setting('t.am2')::uuid) ->> 'count')::int, 0,
  'cards the owner already holds are left alone');
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from pipeline.opportunity where owner_id = current_setting('t.am1')::uuid), 5,
  'one Undo gives them all back');

select test.as_person(current_setting('t.am2')::uuid);
select test.eq((select jsonb_object_agg(c ->> 'entity', 1) from jsonb_array_elements(api.partner_pipeline(
  current_setting('t.p')::uuid)) c), '{"tender": 1, "opportunity": 1}'::jsonb,
  'the organisation''s card shows its tenders and opportunities');
select test.eq(jsonb_array_length(api.partner_pipeline(current_setting('t.p')::uuid)), 6, 'all six of them');
