-- ACH-05 — the Past work grid's door for achievements (V400, V491, V504, V506; OLD-PRF-045), in the shape the grid
-- sends (#105). One paste is one request of Backfilled achievements: each with its day — an undated row takes the
-- report's last day, the quarter's for the Commercial quarterly — the report as its evidence, its owner or Unknown,
-- its plan the one of its own year; none tells anyone or is ever "logged late"; a key already held is left out and
-- named, so the same paste twice adds nothing; a row before 1 January 2025 is refused by its index; a member backfills
-- only their own rows; one Undo takes the paste back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-pasted-achievement-saved-twice.sql, an-undated-achievement-dated-today.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p25', api.plan_open(test.department('commercial'), 2025) ->> 'id', true);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Backfill Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.req', jsonb_build_object('mode', 'achievements', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'bd_monthly', 'period', '2026-03', 'last_day', '2026-03-31'),
  'rows', jsonb_build_array(
    jsonb_build_object('title', 'Made-up March contract', 'happened_on', '2026-03-10', 'date_from_report', false,
                       'kind', 'CONTRACT', 'person_id', current_setting('t.am1'), 'owner_unknown', false,
                       'organisation_id', current_setting('t.org'), 'notes', null, 'import_key', 'made-up-a-1',
                       'value', 90000),
    jsonb_build_object('title', 'Made-up undated award', 'happened_on', null, 'date_from_report', true,
                       'kind', 'AWARD', 'person_id', null, 'owner_unknown', true, 'organisation_id', null,
                       'notes', 'made up', 'import_key', 'made-up-a-2'),
    jsonb_build_object('title', 'Made-up 2025 saving', 'happened_on', '2025-11-04', 'date_from_report', false,
                       'kind', 'cost', 'person_id', null, 'owner_unknown', false, 'organisation_id', null,
                       'notes', null, 'import_key', 'made-up-a-3')))::text, true);

select set_config('t.done', api.backfill_achievements(current_setting('t.req')::jsonb)::text, true);
select test.eq((current_setting('t.done')::jsonb ->> 'saved')::int, 3, 'the paste saves its three rows');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select id from perf.achievement where origin = 'backfill')), 1, 'in one request');
select test.eq((select happened_on from perf.achievement where import_key = 'made-up-a-2'), date '2026-03-31',
  'an undated row takes the report''s last day (V504)');
select test.eq((select date_from_report from perf.achievement where import_key = 'made-up-a-2'), true,
  'marked as the report''s date');
select test.eq((select happened_on from perf.achievement where import_key = 'made-up-a-1'), date '2026-03-10',
  'a dated row keeps its own day');
select test.eq((select source_kind || ' ' || source_period from perf.achievement where import_key = 'made-up-a-1'),
  'bd_monthly 2026-03', 'each row keeps its source report (V506)');
select test.eq((select owner_id from perf.achievement where import_key = 'made-up-a-2'), null::uuid,
  'an Unknown owner stays (V491)');
select test.eq((select owner_id from perf.achievement where import_key = 'made-up-a-3'), current_setting('t.mgr')::uuid,
  'a row with no person is the paster''s own');
select test.eq((select plan_id from perf.achievement where import_key = 'made-up-a-3'), current_setting('t.p25')::uuid,
  'a 2025 row goes to the 2025 plan (V506)');
select test.eq((select deal_value from perf.achievement where import_key = 'made-up-a-1'), 90000::numeric(14,2),
  'with its deal value (V505)');
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.done')::jsonb ->> 'request_id')::uuid), 0, 'nobody is told');
select test.eq((select count(*)::int from perf.achievement a
                where a.origin = 'backfill' and ((perf.achievement_flags(a) ->> 'logged_late')::boolean
                                                 or not (perf.achievement_flags(a) ->> 'backfilled')::boolean
                                                 or (perf.achievement_flags(a) ->> 'no_evidence')::boolean)), 0,
  'every row Backfilled, its report its evidence, none logged late');

select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.backfill_achievement_keys_held(array['made-up-a-1', 'made-up-a-9']), '["made-up-a-1"]'::jsonb,
  'the keys held are named');
select set_config('t.again', api.backfill_achievements(current_setting('t.req')::jsonb)::text, true);
select test.eq((current_setting('t.again')::jsonb ->> 'saved')::int, 0, 'the same paste twice adds nothing');
select test.eq(jsonb_array_length(current_setting('t.again')::jsonb -> 'held'), 3, 'and names what was held');
select test.eq((api.achievements(jsonb_build_object('backfilled', true)) ->> 'total')::int, 3, 'still three');

select set_config('t.q', api.backfill_achievements(jsonb_build_object('mode', 'achievements', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'commercial_quarterly', 'period', '2026-Q2', 'last_day', '2026-06-30'),
  'rows', jsonb_build_array(jsonb_build_object('title', 'Made-up Q2 award', 'kind', 'AWARD',
                                               'import_key', 'made-up-a-4'))))::text, true);
select test.eq((api.achievement((current_setting('t.q')::jsonb -> 'ids' ->> 0)::uuid) ->> 'happened_on'), '2026-06-30',
  'an undated quarterly row takes the quarter''s last day');

select test.raises(format('select api.backfill_achievements(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made up', 'happened_on', '2024-12-31', 'kind', 'AWARD',
                                       'import_key', 'made-up-a-0')))),
  'P0001', 'a row before 1 January 2025 is refused', 'backfill.before_2025');
select test.raises(format('select api.backfill_achievements(%L::jsonb)', current_setting('t.req')::jsonb - 'source'),
  'P0001', 'every paste names its report', 'backfill.source_required');
select test.raises(format('select api.backfill_achievements(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb,
  '{source}', '{"kind": "quality", "period": "2026-03", "last_day": "2026-03-31"}')),
  'P0001', 'never a Quality report (V506)', 'backfill.source_required');
select test.raises(format('select api.backfill_achievements(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made up', 'kind', 'NOT-A-CODE', 'import_key', 'made-up-a-8')))),
  'P0002', 'a category of the plan only', 'list.unknown_value');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.backfill_achievements(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made up', 'kind', 'AWARD', 'person_id', current_setting('t.mgr'),
                                       'import_key', 'made-up-a-5')))),
  '42501', 'a member backfills only their own rows', 'access.needs_level');
select test.raises(format('select api.backfill_achievements(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made up', 'kind', 'AWARD', 'owner_unknown', true,
                                       'import_key', 'made-up-a-5')))),
  '42501', 'and leaves no owner Unknown', 'access.needs_level');
select test.eq((api.backfill_achievements(jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made-up my own', 'kind', 'AWARD', 'import_key', 'made-up-a-6'))))
  ->> 'saved')::int, 1, 'their own they do');

select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.done')::jsonb ->> 'request_id'), 'one Undo');
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement where import_key in ('made-up-a-1', 'made-up-a-2', 'made-up-a-3')
                and deleted_at is null), 0, 'takes the paste back');
