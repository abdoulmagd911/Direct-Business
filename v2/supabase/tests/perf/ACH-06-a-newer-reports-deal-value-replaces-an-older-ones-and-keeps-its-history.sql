-- ACH-06 — the newest issued report wins (V502, V505, V500). A deal value pasted from the BD monthly report of March
-- is replaced by the Commercial quarterly of Q1 (the same last day: the quarterly beats the monthly) and by a later
-- month's report; an older report's value is held, never applied; the older value stays in the change log; a value a
-- person typed is kept whatever a report says; a blank value is filled. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-older-report-overwrites-the-deal-value.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
create temp table paste (n int primary key, req jsonb);
insert into paste values
  (1, '{"kind": "bd_monthly", "period": "2026-03", "last_day": "2026-03-31"}'),
  (2, '{"kind": "commercial_quarterly", "period": "2026-Q1", "last_day": "2026-03-31"}'),
  (3, '{"kind": "bd_monthly", "period": "2026-02", "last_day": "2026-02-28"}'),
  (4, '{"kind": "partnerships", "period": "2026-04", "last_day": "2026-04-30"}');
update paste set req = jsonb_build_object('mode', 'achievements', 'origin', 'backfill', 'source', req,
  'rows', jsonb_build_array(jsonb_build_object('title', 'Made-up ministry contract', 'happened_on', '2026-02-12',
                                               'kind', 'CONTRACT', 'import_key', 'made-up-deal-1',
                                               'value', 100000 + n * 1000)));
grant select on paste to authenticated;

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.id', api.backfill_achievements((select req from paste where n = 1)) -> 'ids' ->> 0, true);
select test.eq((api.achievement(current_setting('t.id')::uuid) ->> 'deal_value')::numeric, 101000::numeric,
  'the March monthly''s value');
select set_config('t.q', api.backfill_achievements((select req from paste where n = 2))::text, true);
select test.eq(current_setting('t.q')::jsonb -> 'updated', '["made-up-deal-1"]'::jsonb,
  'the Q1 quarterly, the same last day, is newer');
select test.eq((api.achievement(current_setting('t.id')::uuid) ->> 'deal_value')::numeric, 102000::numeric,
  'and its value replaces the monthly''s');
select test.eq(api.achievement(current_setting('t.id')::uuid) ->> 'value_report_kind', 'commercial_quarterly',
  'naming the report it came from');
select set_config('t.old', api.backfill_achievements((select req from paste where n = 3))::text, true);
select test.eq(current_setting('t.old')::jsonb -> 'held', '["made-up-deal-1"]'::jsonb, 'an older report is held');
select test.eq((api.achievement(current_setting('t.id')::uuid) ->> 'deal_value')::numeric, 102000::numeric,
  'and changes nothing');
select test.runs($$select api.backfill_achievements((select req from paste where n = 4))$$, 'a later month''s report');
select test.eq((api.achievement(current_setting('t.id')::uuid) ->> 'deal_value')::numeric, 104000::numeric,
  'replaces it again');
select test.eq((api.achievements(jsonb_build_object('backfilled', true)) ->> 'total')::int, 1,
  'one achievement throughout');
select test.as_owner();
select test.eq((select array_agg((c.before ->> 'deal_value')::numeric order by c.id) from audit.change c
                where c.row_id = current_setting('t.id')::uuid and 'deal_value' = any (c.fields) and c.action = 'update'),
  array[101000, 102000]::numeric[], 'every older value stays in the history (V500)');

-- a person's value is kept; a blank one is filled
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.achievement_update(%L, %L::jsonb, %s)', current_setting('t.id'),
  '{"deal_value": 150000}', api.achievement(current_setting('t.id')::uuid) ->> 'version'), 'a person types the value');
update paste set req = jsonb_set(req, '{source}', '{"kind": "bd_monthly", "period": "2026-05", "last_day": "2026-05-31"}')
where n = 1;
select set_config('t.k', api.backfill_achievements((select req from paste where n = 1))::text, true);
select test.eq(current_setting('t.k')::jsonb -> 'kept', '["made-up-deal-1"]'::jsonb, 'a report never replaces it');
select test.eq((api.achievement(current_setting('t.id')::uuid) ->> 'deal_value')::numeric, 150000::numeric, 'it stays');
select set_config('t.blank', api.backfill_achievements(jsonb_set((select req from paste where n = 3), '{rows,0}',
  '{"title": "Made-up second contract", "happened_on": "2026-02-20", "kind": "CONTRACT", "import_key": "made-up-deal-2"}'))
  -> 'ids' ->> 0, true);
select test.runs($$select api.backfill_achievements(jsonb_set((select req from paste where n = 3), '{rows,0}',
  '{"title": "Made-up second contract", "happened_on": "2026-02-20", "kind": "CONTRACT", "import_key": "made-up-deal-2",
    "value": 5000}'))$$, 'the same row again, now with a value');
select test.eq((api.achievement(current_setting('t.blank')::uuid) ->> 'deal_value')::numeric, 5000::numeric,
  'fills a blank value');
