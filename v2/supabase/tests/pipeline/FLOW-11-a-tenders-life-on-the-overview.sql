-- FLOW-11 — a tender's life (TECH-SPEC §10; V80, V503, V477, V511): a made-up Government-segment entity's tender moves
-- Identified → Submitted on 10 Sep → Awarded 500,000 on 20 Sep; Q3's tenders submitted is 1 and stays 1 when a second
-- tender is later Lost; awarded value 500,000; a logged Contract signed raises government entity contracts by 1; the
-- Overview with segment Government shows all three and the funnel, against last year's Q3; under another segment
-- there are none; the money tiles are not measured until Finance (never 0); Undo of the award reverts every figure;
-- only those who may view the Overview read it. Every value is made up.
-- Sabotages: supabase/tests/sabotage/the-overview-ignores-its-segment.sql,
--            supabase/tests/sabotage/the-money-tiles-show-zero.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Bid Owner', 'member')::text, true);
select test.as_owner();
select perf.plans_open_missing(array[2026]);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ministry',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.tender_save(null, jsonb_build_object('title', 'Made-up delegation travel', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 600000, 'happened_on', '2026-09-01')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.t')::uuid, 'submitted', '2026-09-10');
select set_config('t.award', api.pipeline_move('tender', current_setting('t.t')::uuid, 'awarded', '2026-09-20',
  '{"awarded_value_sar": 500000}') ->> 'request_id', true);
select set_config('t.u', api.tender_save(null, jsonb_build_object('title', 'Made-up second bid', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'happened_on', '2026-09-05')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.u')::uuid, 'lost', '2026-09-25', '{"lost_reason": "price"}');
select api.achievement_log(jsonb_build_object('category', 'CONTRACT', 'title', 'Made-up delegation contract',
  'happened_on', '2026-09-28', 'partner_id', current_setting('t.gov'), 'deal_value', 500000));

select test.raises(format('select api.overview(%L, %L, %L)', 'custom', '2026-07-01', '2026-09-30'), '42501',
  'a member does not read the Overview', 'access.needs_level');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.o', api.overview('custom', '2026-07-01', '2026-09-30', 'government')::text, true);
select test.eq((select jsonb_build_object('submitted', o #> '{tiles,tenders_submitted,value}',
                                          'awarded', o #> '{tiles,awarded_value,value}',
                                          'contracts', o #> '{tiles,government_contracts,value}',
                                          'last_year', o #> '{tiles,tenders_submitted,last_year}')
                from (select current_setting('t.o')::jsonb o) x),
  '{"submitted": 1, "awarded": 500000, "contracts": 1, "last_year": 0}'::jsonb,
  'Q3 under Government: one submitted, 500 000 awarded, one contract — none last year');
select test.eq((select jsonb_object_agg(s ->> 'stage', s -> 'n') filter (where (s ->> 'n')::int > 0)
                from jsonb_array_elements(current_setting('t.o')::jsonb #> '{funnels,tenders}') s),
  '{"awarded": 1, "lost": 1}'::jsonb, 'and the funnel as of 30 Sep');
select test.eq(current_setting('t.o')::jsonb #> '{last_year}',
  '{"from": "2025-07-01", "to": "2025-09-30"}'::jsonb, 'against the same days last year');
select test.eq((select jsonb_build_object('revenue', o #> '{tiles,revenue,measured}', 'value', o #> '{tiles,revenue,value}',
                                          'active', o #> '{tiles,clients,active,measured}')
                from (select current_setting('t.o')::jsonb o) x),
  '{"revenue": false, "value": null, "active": false}'::jsonb, 'the money tiles are not measured until Finance — never 0');
select test.eq((select jsonb_build_object('submitted', o #> '{tiles,tenders_submitted,value}',
                                          'contracts', o #> '{tiles,government_contracts,value}')
                from (select api.overview('custom', '2026-07-01', '2026-09-30', 'corporate') o) x),
  '{"submitted": 0, "contracts": 0}'::jsonb, 'under Corporate there are none');
select test.eq((select jsonb_build_object('from', o #>> '{period,from}', 'sign_ups', o #> '{tiles,clients,sign_ups,value}',
                                          'onboarded', o #> '{tiles,clients,onboarded,value}')
                from (select api.overview('mtd', null, null, 'government') o) x),
  '{"from": "2026-10-01", "sign_ups": 1, "onboarded": 0}'::jsonb,
  'month to date: the entity signed up on 1 Oct, its Client side not yet Active');
select test.raises(format('select api.overview(%L, %L, %L)', 'custom', '2026-09-30', '2026-07-01'), 'P0001',
  'a period ends after it starts', 'overview.period_invalid');

-- Undo of the award reverts every figure it made
select test.as_person(current_setting('t.am1')::uuid);
select api.undo(current_setting('t.award')::uuid);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.o', api.overview('custom', '2026-07-01', '2026-09-30', 'government')::text, true);
select test.eq((select jsonb_build_object('submitted', o #> '{tiles,tenders_submitted,value}',
                                          'awarded', o #> '{tiles,awarded_value,value}',
                                          'in_awarded', (select (s ->> 'n')::int from jsonb_array_elements(o #> '{funnels,tenders}') s
                                                         where s ->> 'stage' = 'awarded'))
                from (select current_setting('t.o')::jsonb o) x),
  '{"submitted": 1, "awarded": 0, "in_awarded": 0}'::jsonb, 'Undo of the award: nothing awarded, still submitted');
