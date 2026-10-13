-- PIPE-06 — the pipeline measures (TECH-SPEC §3.7a, §3.8; V80, V99, V400, V503, V64): tenders submitted and signed,
-- and partnerships signed and onboarded, each counted in the period its history reached the stage — entered or passed
-- on the way, a later Lost never taking it out; awarded value by the award date, no award a real 0; the funnels as of
-- the period's last day, every stage in order with its cards and their value; scopes department and person; the
-- segment, the organisation's Client type unless a Client opportunity names its own; an unknown segment refused.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/submitted-counts-only-the-stage-entered.sql,
--            supabase/tests/sabotage/a-later-lost-takes-the-submission-out.sql,
--            supabase/tests/sabotage/awarded-value-by-when-it-was-typed.sql,
--            supabase/tests/sabotage/the-funnel-reads-todays-stage.sql,
--            supabase/tests/sabotage/the-segment-is-ignored.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Bid Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test Other Desk', 'member', 'test_other_desk')::text, true);
select set_config('t.d', core.riyadh_today()::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);
select set_config('t.corp', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Holding',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.supp', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Channel',
  'sides', jsonb_build_array(jsonb_build_object('side', 'supplier_partner', 'type', 'sales_channel')))) ->> 'id', true);
select set_config('t.supp2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Engine',
  'sides', jsonb_build_array(jsonb_build_object('side', 'supplier_partner', 'type', 'supplier')))) ->> 'id', true);

-- Tenders. T1: submitted D-30 (passing Preparing), awarded D-20, signed D-10. T2: submitted D-25, lost D-15.
-- T3: submitted D-45, before the period. T5 (the head's, a corporate bid with a reason): submitted D-20.
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.T1', api.tender_save(null, jsonb_build_object('title', 'Made-up T1', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 120000,
  'happened_on', current_setting('t.d')::date - 40)) ->> 'id', true);
select set_config('t.T2', api.tender_save(null, jsonb_build_object('title', 'Made-up T2', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 40000,
  'happened_on', current_setting('t.d')::date - 40)) ->> 'id', true);
select set_config('t.T3', api.tender_save(null, jsonb_build_object('title', 'Made-up T3', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 30000,
  'happened_on', current_setting('t.d')::date - 50)) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'submitted', current_setting('t.d')::date - 30);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'awarded', current_setting('t.d')::date - 20,
  '{"awarded_value_sar": 100000}');
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'signed', current_setting('t.d')::date - 10);
select api.pipeline_move('tender', current_setting('t.T2')::uuid, 'submitted', current_setting('t.d')::date - 25);
select api.pipeline_move('tender', current_setting('t.T2')::uuid, 'lost', current_setting('t.d')::date - 15,
  '{"lost_reason": "price"}');
select api.pipeline_move('tender', current_setting('t.T3')::uuid, 'submitted', current_setting('t.d')::date - 45);
-- T4, another department's: straight to Awarded on D-28, passing Preparing and Submitted
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.T4', api.tender_save(null, jsonb_build_object('title', 'Made-up T4', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'happened_on', current_setting('t.d')::date - 40)) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T4')::uuid, 'awarded', current_setting('t.d')::date - 28,
  '{"awarded_value_sar": 50000}');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.T5', api.tender_save(null, jsonb_build_object('title', 'Made-up T5', 'partner_id',
  current_setting('t.corp'), 'source', 'outbound', 'segment_reason', 'Made-up: a semi-government company',
  'happened_on', current_setting('t.d')::date - 40)) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T5')::uuid, 'submitted', current_setting('t.d')::date - 20);

select test.as_owner();
select set_config('t.from', (current_setting('t.d')::date - 31)::text, true);
select set_config('t.to', (current_setting('t.d')::date - 1)::text, true);
select test.eq((select array_agg(i.happened_on order by i.happened_on) from measure.pipeline_tenders_submitted_items(null,
  'person', current_setting('t.am1')::uuid, current_setting('t.from')::date, current_setting('t.to')::date) i),
  array[current_setting('t.d')::date - 30, current_setting('t.d')::date - 25],
  'each on the day it reached Submitted — a later Lost still counts');
select test.eq((measure.pipeline_tenders_submitted(null, 'company', null, current_setting('t.from')::date,
  current_setting('t.to')::date)).value, 4::numeric,
  'four tenders reached Submitted in the period — passed on the way included, T3 before it');
select test.eq((measure.pipeline_tenders_submitted(null, 'department', test.department('commercial'),
  current_setting('t.from')::date, current_setting('t.to')::date)).value, 3::numeric,
  'the department''s three — the other desk''s T4 is not');
select test.eq((measure.pipeline_tenders_submitted('{"segment": "government"}', 'company', null,
  current_setting('t.from')::date, current_setting('t.to')::date)).value, 3::numeric, 'the government segment''s three');
select test.eq((measure.pipeline_tenders_submitted('{"segment": "corporate"}', 'company', null,
  current_setting('t.from')::date, current_setting('t.to')::date)).value, 1::numeric, 'and the corporate bid alone');
select test.raises(format('select measure.pipeline_tenders_submitted(%L, %L, null, %L, %L)', '{"segment": "nowhere"}',
  'company', current_setting('t.from'), current_setting('t.to')), 'P0002', 'an unknown segment is refused',
  'list.unknown_value');
select test.eq(measure.pipeline_tenders_signed(null, 'company', null, current_setting('t.from')::date,
  current_setting('t.to')::date), (1, true, 1)::measure.result, 'one tender signed — at signing, not at award');

-- Awarded value: by the award date; no award is a real 0
select test.eq(measure.pipeline_awarded_value(null, 'company', null, current_setting('t.from')::date,
  current_setting('t.to')::date), (150000, true, 2)::measure.result, 'two awards in the period by their award dates');
select test.eq(measure.pipeline_awarded_value(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.d')::date - 19, current_setting('t.to')::date), (0, true, 0)::measure.result,
  'none awarded since D-19 for the bid owner: a real 0');

-- The funnel as of the period's last day, and as of D-26
select test.eq((select jsonb_object_agg(f.stage_key, jsonb_build_array(f.n, f.value))
                from measure.pipeline_tenders_by_stage(null, 'department', test.department('commercial'),
                  current_setting('t.from')::date, current_setting('t.to')::date) f),
  '{"identified": [0, 0], "preparing": [0, 0], "submitted": [2, 30000], "clarifying": [0, 0], "awarded": [0, 0],
    "signed": [1, 100000], "lost": [1, 40000], "cancelled": [0, 0]}'::jsonb,
  'every stage with its cards and value — the signed one at its awarded value');
select test.eq((select array_agg(f.stage_key order by f.sort) from measure.pipeline_tenders_by_stage(null, 'company',
  null, current_setting('t.from')::date, current_setting('t.to')::date) f),
  array['identified', 'preparing', 'submitted', 'clarifying', 'awarded', 'signed', 'lost', 'cancelled'],
  'in the board''s order');
select test.eq((select jsonb_object_agg(f.stage_key, f.n) filter (where f.n > 0)
                from measure.pipeline_tenders_by_stage(null, 'person', current_setting('t.am1')::uuid,
                  current_setting('t.from')::date, current_setting('t.d')::date - 26) f),
  '{"identified": 1, "submitted": 2}'::jsonb, 'as of D-26: T2 not yet submitted, T1 and T3 were');
select test.eq((select array_agg(i.entity_id::text order by i.entity_id) from measure.pipeline_tenders_by_stage_items(
  '{"stage": "submitted"}', 'department', test.department('commercial'), current_setting('t.from')::date,
  current_setting('t.to')::date) i), (select array_agg(x order by x) from unnest(array[current_setting('t.T3'),
  current_setting('t.T5')]) x), 'the drill-down names the cards in the stage');

-- Partnerships. O1: a client opportunity, signed D-20, handed over D-15, onboarded D-10. O2: a supplier & partner
-- opportunity of an organisation with no Client side, signed D-5.
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.O1', api.opportunity_save(null, jsonb_build_object('title', 'Made-up O1', 'partner_id',
  current_setting('t.supp'), 'side', 'client', 'type', 'corporate', 'source', 'referral', 'expected_value_sar', 70000,
  'happened_on', current_setting('t.d')::date - 40)) ->> 'id', true);
select set_config('t.O2', api.opportunity_save(null, jsonb_build_object('title', 'Made-up O2', 'partner_id',
  current_setting('t.supp2'), 'side', 'supplier_partner', 'type', 'integration', 'source', 'event',
  'expected_value_sar', 20000, 'happened_on', current_setting('t.d')::date - 40)) ->> 'id', true);
select api.pipeline_move('opportunity', current_setting('t.O1')::uuid, 'signed', current_setting('t.d')::date - 20);
select api.pipeline_move('opportunity', current_setting('t.O1')::uuid, 'handed_over', current_setting('t.d')::date - 15,
  '{"ticket_ref": "TCK-000123"}');
select api.pipeline_move('opportunity', current_setting('t.O1')::uuid, 'onboarded', current_setting('t.d')::date - 10);
select api.pipeline_move('opportunity', current_setting('t.O2')::uuid, 'signed', current_setting('t.d')::date - 5);
select test.as_owner();
select test.eq((measure.pipeline_partnerships_signed(null, 'company', null, current_setting('t.from')::date,
  current_setting('t.to')::date)).value, 2::numeric, 'two partnerships signed');
select test.eq((measure.pipeline_partnerships_signed('{"segment": "corporate"}', 'company', null,
  current_setting('t.from')::date, current_setting('t.to')::date)).value, 1::numeric,
  'a Client opportunity counts in the segment it would become');
select test.eq((measure.pipeline_partnerships_onboarded(null, 'person', current_setting('t.am1')::uuid,
  current_setting('t.from')::date, current_setting('t.to')::date)).value, 1::numeric, 'one onboarded');
select test.eq((select jsonb_object_agg(f.stage_key, jsonb_build_array(f.n, f.value)) filter (where f.n > 0)
                from measure.pipeline_opportunities_by_stage(null, 'company', null, current_setting('t.from')::date,
                  current_setting('t.to')::date) f),
  '{"signed": [1, 20000], "onboarded": [1, 70000]}'::jsonb, 'the partnerships'' funnel with their expected values');
