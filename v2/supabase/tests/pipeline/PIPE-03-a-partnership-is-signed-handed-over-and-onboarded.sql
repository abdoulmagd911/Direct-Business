-- PIPE-03 — a partnership opportunity (§3.7a; V99, V457): an organisation and the side it would become, with its Source;
-- Contacted → Signed passes Demo but never the optional Proposal, dates the signing and offers Log achievement and the
-- side's onboarding checklist; Handed to Product needs the Direct ticket; Onboarded switches the side on and sets it
-- Active from that day in the same request, and one Undo reverts all of it; moved back from Onboarded, the card keeps
-- its signing in its history and the organisation keeps its status. Every value is made up.
-- Sabotages: supabase/tests/sabotage/onboarded-leaves-the-side-off.sql, supabase/tests/sabotage/handed-over-without-a-ticket.sql,
--            supabase/tests/sabotage/back-reverts-the-side.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Partnerships', 'member')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Booking Engine',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.c', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Client Prospect',
  'sides', jsonb_build_array(jsonb_build_object('side', 'supplier_partner', 'type', 'sales_channel')))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.opportunity_save(null, %L)', jsonb_build_object('title', 'Made-up integration',
  'partner_id', current_setting('t.p'), 'side', 'supplier_partner', 'type', 'integration')), 'P0001',
  'an opportunity without a Source is refused', 'pipeline.source_required');
select set_config('t.o', api.opportunity_save(null, jsonb_build_object('title', 'Made-up integration',
  'partner_id', current_setting('t.p'), 'side', 'supplier_partner', 'type', 'integration', 'source', 'event',
  'happened_on', core.riyadh_today() - 30)) ->> 'id', true);
select set_config('t.k', api.opportunity_save(null, jsonb_build_object('title', 'Made-up corporate account',
  'partner_id', current_setting('t.c'), 'side', 'client', 'type', 'corporate', 'source', 'referral')) ->> 'id', true);
select test.eq(api.pipeline_card('opportunity', current_setting('t.o')::uuid) ->> 'stage', 'contacted',
  'it starts Contacted');

select set_config('t.m', api.pipeline_move('opportunity', current_setting('t.o')::uuid, 'signed',
  core.riyadh_today() - 20)::text, true);
select test.eq(current_setting('t.m')::jsonb -> 'passed', '["demo"]'::jsonb,
  'Contacted → Signed passes Demo, never the optional Proposal');
select test.eq(current_setting('t.m')::jsonb -> 'offers', '["log_achievement", "supplier_onboarding"]'::jsonb,
  'Signed offers Log achievement and the supplier onboarding checklist');
select test.eq(api.pipeline_move('opportunity', current_setting('t.k')::uuid, 'signed') -> 'offers',
  '["log_achievement", "corporate_onboarding"]'::jsonb, 'a client''s, the corporate onboarding checklist');
select test.raises(format('select api.pipeline_move(%L, %L, %L, %L)', 'opportunity', current_setting('t.o'),
  'handed_over', core.riyadh_today() - 15), 'P0001', 'Handed to Product needs the Direct ticket',
  'opportunity.handover_needs_ticket');
select api.pipeline_move('opportunity', current_setting('t.o')::uuid, 'handed_over', core.riyadh_today() - 15,
  '{"ticket_ref": "TCK-000999"}');

-- Onboarded: the side on and Active from that day, one request, one Undo
select test.as_owner();
select test.ok(not partner.side_on(current_setting('t.p')::uuid, 'supplier_partner'), 'the side is off before');
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.on', api.pipeline_move('opportunity', current_setting('t.o')::uuid, 'onboarded',
  core.riyadh_today() - 10) ->> 'request_id', true);
select test.as_owner();
select test.ok(partner.side_on(current_setting('t.p')::uuid, 'supplier_partner'), 'Onboarded switches the side on');
select test.eq(partner.status_of(current_setting('t.p')::uuid, 'supplier_partner', core.riyadh_today() - 10), 'active',
  'and sets it Active from that day');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.request_id = current_setting('t.on')::uuid
                  and c.table_name in ('pipeline.opportunity', 'partner.partner_side', 'partner.side_status_change')), 1,
  'in the same request');
select test.as_person(current_setting('t.am1')::uuid);
select api.undo(current_setting('t.on')::uuid);
select test.as_owner();
select test.ok(not partner.side_on(current_setting('t.p')::uuid, 'supplier_partner')
               and partner.status_of(current_setting('t.p')::uuid, 'supplier_partner') is null,
  'one Undo reverts the side and its status');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.pipeline_card('opportunity', current_setting('t.o')::uuid) ->> 'stage', 'handed_over',
  'and the card');

-- moved back from Onboarded: the signing stays in the history, the side keeps its status
select api.pipeline_move('opportunity', current_setting('t.o')::uuid, 'onboarded', core.riyadh_today() - 5);
select api.pipeline_move('opportunity', current_setting('t.o')::uuid, 'demo', null,
  '{"note": "Made-up: the integration went back to testing"}');
select test.eq(api.pipeline_card('opportunity', current_setting('t.o')::uuid) -> 'signed_on', 'null'::jsonb,
  'moved back, the card is no longer signed');
select test.eq((select h ->> 'happened_on' from jsonb_array_elements(api.pipeline_card('opportunity',
                current_setting('t.o')::uuid) -> 'history') h where h ->> 'to' = 'signed'),
  (core.riyadh_today() - 20)::text, 'the signing stays in its history');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.p')::uuid, 'supplier_partner'), 'active',
  'and the organisation keeps its status');
