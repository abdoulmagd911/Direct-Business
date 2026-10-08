-- PIPE-08 — a tender at Signed logs its Contract signed (V603, V503): in the move's own request, labelled
-- tender.signed and naming the mover and the tender — the owner's achievement of the Contract signed category, dated at
-- signing, the awarded value as its deal value, the tender's title and organisation, origin pipeline; government entity
-- contracts counts it; moving back keeps it and a second Signed logs nothing new; one Undo reverts the move and the
-- achievement; where the owner's department has no plan for the year, or the owner can no longer work here, the move
-- still goes through and offers Log achievement instead (staff always have a department — core.person's check — so
-- "no department" is covered by the code, not reachable here). Every value is made up.
-- Sabotages: supabase/tests/sabotage/signed-logs-no-contract.sql, supabase/tests/sabotage/a-second-signed-logs-again.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Bid Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test Moving Desk', 'member')::text, true);
select test.as_owner();
select perf.plans_open_missing(array[2026]);
-- a department opened after the plans were: it has none for 2026
select set_config('t.am3', test.person('Test New Desk', 'member', 'test_desk_without_plan')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ministry',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);

-- T1: submitted, awarded 280 000, signed on 25 Sep
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.T1', api.tender_save(null, jsonb_build_object('title', 'Made-up delegation travel', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 300000, 'happened_on', '2026-09-01')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'awarded', '2026-09-20', '{"awarded_value_sar": 280000}');
select set_config('t.m', api.pipeline_move('tender', current_setting('t.T1')::uuid, 'signed', '2026-09-25')::text, true);
select test.eq(current_setting('t.m')::jsonb -> 'offers', '["new_project"]'::jsonb,
  'Signed logs the contract and offers New project alone');
select test.ok((current_setting('t.m')::jsonb #>> '{achievement,number}') like 'ACH-2026-%', 'and names the achievement');
select test.as_owner();
select test.eq((select jsonb_build_object('category', c.code, 'happened_on', a.happened_on, 'deal_value', a.deal_value,
                  'owner', a.owner_id = current_setting('t.am1')::uuid, 'partner', a.partner_id = current_setting('t.gov')::uuid,
                  'title', a.title, 'origin', a.origin, 'repeat_of', a.repeat_of)
                from perf.achievement a join perf.achievement_category c on c.id = a.category_id
                where a.tender_id = current_setting('t.T1')::uuid and a.deleted_at is null),
  '{"category": "CONTRACT", "happened_on": "2026-09-25", "deal_value": 280000, "owner": true, "partner": true,
    "title": "Made-up delegation travel", "origin": "pipeline", "repeat_of": null}'::jsonb,
  'the owner''s Contract signed, dated at signing, with the awarded value');
select test.eq((select count(distinct c.table_name)::int from audit.change c
                where c.request_id = (current_setting('t.m')::jsonb ->> 'request_id')::uuid
                  and c.table_name in ('pipeline.tender', 'perf.achievement')), 2, 'in the move''s own request');
select test.eq((select jsonb_build_object('label', r.label_key, 'number', r.label_args ->> 'number',
                                          'mover', r.actor_id = current_setting('t.am1')::uuid)
                from audit.request r where r.id = (current_setting('t.m')::jsonb ->> 'request_id')::uuid),
  jsonb_build_object('label', 'tender.signed', 'mover', true,
                     'number', (select t.number from pipeline.tender t where t.id = current_setting('t.T1')::uuid)),
  'its history names the mover and the tender');
select test.eq((measure.perf_government_contracts(null, 'company', null, '2026-09-01', '2026-09-30')).value, 1::numeric,
  'government entity contracts counts it');

-- moving back keeps it; a second Signed logs nothing new
select test.as_person(current_setting('t.am1')::uuid);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'awarded', '2026-09-28',
  '{"note": "Made-up: the signature page was missing"}');
select set_config('t.m2', api.pipeline_move('tender', current_setting('t.T1')::uuid, 'signed', '2026-09-29')::text, true);
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement a where a.tender_id = current_setting('t.T1')::uuid
                and a.deleted_at is null), 1, 'moving back keeps it and a second Signed logs nothing new');
select test.eq(current_setting('t.m2')::jsonb -> 'offers', '["new_project"]'::jsonb, 'nor offers it again');

-- one Undo reverts the move and the achievement
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.T2', api.tender_save(null, jsonb_build_object('title', 'Made-up venue tender', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'happened_on', '2026-09-01')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T2')::uuid, 'awarded', '2026-09-15', '{"awarded_value_sar": 90000}');
select set_config('t.r', api.pipeline_move('tender', current_setting('t.T2')::uuid, 'signed', '2026-09-26') ->> 'request_id',
  true);
select api.undo(current_setting('t.r')::uuid);
select test.as_owner();
select test.eq((select jsonb_build_object('achievement', perf.tender_contract(t.id), 'signed_on', t.signed_on)
                from pipeline.tender t where t.id = current_setting('t.T2')::uuid),
  '{"achievement": null, "signed_on": null}'::jsonb, 'one Undo reverts the move and the achievement');

-- no plan for the year, or no department: the move goes through and offers Log achievement
select test.as_person(current_setting('t.am3')::uuid);
select set_config('t.T3', api.tender_save(null, jsonb_build_object('title', 'Made-up desk tender', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'happened_on', '2026-09-01')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T3')::uuid, 'awarded', '2026-09-15', '{"awarded_value_sar": 10000}');
select test.eq(api.pipeline_move('tender', current_setting('t.T3')::uuid, 'signed', '2026-09-20') -> 'offers',
  '["log_achievement", "new_project"]'::jsonb, 'no plan for the year: signed, and Log achievement offered');
select test.as_person(current_setting('t.am2')::uuid);
select set_config('t.T4', api.tender_save(null, jsonb_build_object('title', 'Made-up moving tender', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'happened_on', '2026-09-01')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T4')::uuid, 'awarded', '2026-09-15', '{"awarded_value_sar": 20000}');
select test.as_owner();
update core.person set can_sign_in = false where id = current_setting('t.am2')::uuid;
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.pipeline_move('tender', current_setting('t.T4')::uuid, 'signed', '2026-09-20') -> 'offers',
  '["log_achievement", "new_project"]'::jsonb, 'an owner switched off: signed, and Log achievement offered');
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement a
                where a.tender_id in (current_setting('t.T3')::uuid, current_setting('t.T4')::uuid)), 0,
  'and nothing logged for either');
