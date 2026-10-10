-- PIPE-01 — a tender (§3.7a, V80, V99): numbered TND-year-number, a government entity's, with the Source every card
-- needs; another segment takes Full on the Pipeline and a reason; Own adds one's own and changes only one's own; giving
-- it to someone else needs pipeline.assign; the whole team sees it, a viewer too. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-tender-without-a-source.sql, supabase/tests/sabotage/any-segment-takes-a-tender.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Bid Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test Other Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Ministry',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);
select set_config('t.corp', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Holding Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.tender_save(null, %L)', jsonb_build_object('title', 'Made-up travel services',
  'partner_id', current_setting('t.gov'))), 'P0001', 'a tender without a Source is refused', 'pipeline.source_required');
select set_config('t.r', api.tender_save(null, jsonb_build_object('title', 'Made-up travel services',
  'partner_id', current_setting('t.gov'), 'source', 'tender_portal', 'etimad_ref', 'ETM-000001',
  'value_sar', 250000))::text, true);
select set_config('t.t', current_setting('t.r')::jsonb ->> 'id', true);
select test.ok(current_setting('t.r')::jsonb ->> 'number' ~ '^TND-[0-9]{4}-[0-9]{3}$', 'numbered TND-year-number');
select test.eq(api.pipeline_card('tender', current_setting('t.t')::uuid) ->> 'stage', 'identified', 'it starts Identified');
select test.eq(jsonb_array_length(api.pipeline_card('tender', current_setting('t.t')::uuid) -> 'history'), 1,
  'with its first history line');
select test.raises(format('select api.tender_save(null, %L)', jsonb_build_object('title', 'Made-up corporate bid',
  'partner_id', current_setting('t.corp'), 'source', 'outbound')), '42501',
  'a tender outside the Government segment is not a member''s to add', 'tender.not_government');
select test.raises(format('select api.tender_save(null, %L)', jsonb_build_object('title', 'Made-up handover bid',
  'partner_id', current_setting('t.gov'), 'source', 'outbound', 'owner_id', current_setting('t.am2'))), '42501',
  'nor is giving one to someone else', 'access.needs_capability');

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.tender_save(null, %L)', jsonb_build_object('title', 'Made-up corporate bid',
  'partner_id', current_setting('t.corp'), 'source', 'outbound')), 'P0001',
  'a manager adds one with a reason', 'tender.segment_reason_required');
select test.runs(format('select api.tender_save(null, %L)', jsonb_build_object('title', 'Made-up corporate bid',
  'partner_id', current_setting('t.corp'), 'source', 'outbound', 'segment_reason', 'Made-up: a semi-government company',
  'owner_id', current_setting('t.am2'))), 'with the reason, and to someone else, it is added');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'assigned' and entity_table = 'pipeline.tender'), 1, 'the new owner is told');

select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.pipeline_card('tender', current_setting('t.t')::uuid) ->> 'number',
  current_setting('t.r')::jsonb ->> 'number', 'the whole team sees it');
select test.raises(format('select api.tender_save(%L, %L, 1)', current_setting('t.t'), '{"title": "Made up"}'), '42501',
  'but changes only its own', 'access.needs_level');
select test.as_person(current_setting('t.viewer')::uuid);
select test.ok(api.pipeline_card('tender', current_setting('t.t')::uuid) is not null, 'a viewer reads it');
select test.raises(format('select api.tender_save(null, %L)', jsonb_build_object('title', 'Made up',
  'partner_id', current_setting('t.gov'), 'source', 'outbound')), '42501', 'and adds none', 'access.needs_level');
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.tender_save(%L, %L, 1)', current_setting('t.t'),
  '{"tender_no": "MADE-UP-77", "submission_due_on": "2030-01-31"}'), 'its owner changes it');
