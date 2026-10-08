-- PIPE-02 — moving a tender (§3.7a; V400, V481, V503): Identified → Submitted records Preparing on the same date and
-- dates the submission; skipping Clarification / negotiation records no pass; Awarded needs its value and dates the
-- award; Signed dates the signing and offers Log achievement and New project; a move is never dated before the last;
-- moving back needs a reason, clears the dates moved back over and keeps them in the history; Lost needs a reason of
-- the tenders' board. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-jump-records-no-passes.sql, supabase/tests/sabotage/a-skipped-optional-stage-is-passed.sql,
--            supabase/tests/sabotage/awarded-without-its-value.sql, supabase/tests/sabotage/back-without-a-reason.sql.
select set_config('t.am1', test.person('Test Bid Owner', 'member')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.tender_save(null, jsonb_build_object('title', 'Made-up event travel',
  'partner_id', current_setting('t.gov'), 'source', 'tender_portal', 'happened_on', core.riyadh_today() - 20)) ->> 'id', true);
select set_config('t.u', api.tender_save(null, jsonb_build_object('title', 'Made-up lost bid',
  'partner_id', current_setting('t.gov'), 'source', 'tender_portal')) ->> 'id', true);

select test.eq(api.pipeline_move('tender', current_setting('t.t')::uuid, 'submitted', core.riyadh_today() - 10) -> 'passed',
  '["preparing"]'::jsonb, 'Identified → Submitted passes Preparing');
select test.eq((select jsonb_agg(jsonb_build_array(h ->> 'to', h -> 'passed', h ->> 'happened_on'))
                from jsonb_array_elements(api.pipeline_card('tender', current_setting('t.t')::uuid) -> 'history') h),
  jsonb_build_array(jsonb_build_array('identified', false, (core.riyadh_today() - 20)::text),
                    jsonb_build_array('preparing', true, (core.riyadh_today() - 10)::text),
                    jsonb_build_array('submitted', false, (core.riyadh_today() - 10)::text)),
  'recorded on the same date');
select test.eq(api.pipeline_card('tender', current_setting('t.t')::uuid) ->> 'submitted_on',
  (core.riyadh_today() - 10)::text, 'and the submission dated');

select test.raises(format('select api.pipeline_move(%L, %L, %L, %L)', 'tender', current_setting('t.t'), 'awarded',
  core.riyadh_today() - 5), 'P0001', 'Awarded needs its value', 'tender.awarded_needs_value');
select test.raises(format('select api.pipeline_move(%L, %L, %L, %L, %L)', 'tender', current_setting('t.t'), 'awarded',
  core.riyadh_today() - 12, '{"awarded_value_sar": 180000}'), 'P0001', 'a move is never dated before the last',
  'pipeline.before_last_move');
select test.eq(api.pipeline_move('tender', current_setting('t.t')::uuid, 'awarded', core.riyadh_today() - 5,
  '{"awarded_value_sar": 180000}') -> 'passed', '[]'::jsonb, 'skipping Clarification / negotiation records no pass');
select test.eq((select jsonb_build_object('value', c -> 'awarded_value_sar', 'on', c ->> 'awarded_on')
                from (select api.pipeline_card('tender', current_setting('t.t')::uuid) c) x),
  jsonb_build_object('value', 180000, 'on', (core.riyadh_today() - 5)::text), 'the award has its value and date');
select test.eq(api.pipeline_move('tender', current_setting('t.t')::uuid, 'signed', core.riyadh_today() - 1) -> 'offers',
  '["log_achievement", "new_project"]'::jsonb, 'Signed offers Log achievement and New project');
select test.eq(api.pipeline_card('tender', current_setting('t.t')::uuid) ->> 'signed_on',
  (core.riyadh_today() - 1)::text, 'and dates the signing');
select test.raises(format('select api.pipeline_move(%L, %L, %L)', 'tender', current_setting('t.t'), 'signed'), 'P0001',
  'a card is not moved to where it is', 'pipeline.same_stage');

select test.raises(format('select api.pipeline_move(%L, %L, %L)', 'tender', current_setting('t.t'), 'submitted'), 'P0001',
  'moving back needs a reason', 'pipeline.backward_needs_reason');
select api.pipeline_move('tender', current_setting('t.t')::uuid, 'submitted', null,
  '{"note": "Made-up: the entity reopened the evaluation"}');
select test.eq((select jsonb_build_object('signed_on', c -> 'signed_on', 'awarded_on', c -> 'awarded_on',
                                          'submitted_on', c ->> 'submitted_on')
                from (select api.pipeline_card('tender', current_setting('t.t')::uuid) c) x),
  jsonb_build_object('signed_on', null, 'awarded_on', null, 'submitted_on', (core.riyadh_today() - 10)::text),
  'the dates moved back over are cleared on the card');
select test.eq((select count(*)::int from jsonb_array_elements(api.pipeline_card('tender', current_setting('t.t')::uuid)
                -> 'history') h where h ->> 'to' = 'signed'), 1, 'and kept in its history');

select test.raises(format('select api.pipeline_move(%L, %L, %L)', 'tender', current_setting('t.u'), 'lost'), 'P0001',
  'Lost needs a reason', 'pipeline.lost_needs_reason');
select test.raises(format('select api.pipeline_move(%L, %L, %L, null, %L)', 'tender', current_setting('t.u'), 'lost',
  '{"lost_reason": "competitor"}'), 'P0002', 'one of the tenders'' board', 'list.unknown_value');
select api.pipeline_move('tender', current_setting('t.u')::uuid, 'lost', null, '{"lost_reason": "price"}');
select test.eq(api.pipeline_card('tender', current_setting('t.u')::uuid) ->> 'lost_reason', 'price', 'lost on price');
