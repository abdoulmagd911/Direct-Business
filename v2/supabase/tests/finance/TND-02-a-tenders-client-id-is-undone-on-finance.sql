-- TND-02 — a tender's client ID is named on Finance, and undone on Finance (QA-539; V614, V627). A finance lead with
-- Full on Finance and only View on Pipeline names a tender's client ID and, past the undo window, undoes it — the change
-- is judged on Finance, where it was made, not on the tender's Pipeline page; an account manager with Own on Finance
-- cannot undo it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-tenders-client-id-is-undone-on-pipeline.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.lead', test.person('Test Finance Lead', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.lead')::uuid, 'pipeline', 'view', 'made up: Finance only');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.gov')::uuid, 'payments_client_id', '88001', 'made up', 'tender');
select set_config('t.T1', api.tender_save(null, jsonb_build_object('title', 'Made-up delegation travel', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal', 'value_sar', 1000, 'happened_on', '2026-08-20')) ->> 'id', true);
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'awarded', '2026-09-05', '{"awarded_value_sar": 900}');
select api.pipeline_move('tender', current_setting('t.T1')::uuid, 'signed', '2026-09-10');
select test.as_owner();
select set_config('t.id1', (select id::text from partner.identifier where value_raw = '88001'), true);

select test.as_person(current_setting('t.lead')::uuid);
select api.finance_tender_client_id_set(current_setting('t.T1')::uuid, current_setting('t.id1')::uuid,
                                        'made up: the award letter names it');
select test.as_owner();
select set_config('t.req', (test.last_change('pipeline.tender', current_setting('t.T1')::uuid)).request_id::text, true);
-- past the undo window
update audit.request set at = at - interval '3 days' where id = current_setting('t.req')::uuid;

select test.as_person(current_setting('t.am')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.req')), '42501',
  'Own on Finance cannot undo naming a tender''s client ID', 'undo.not_allowed');
select test.as_person(current_setting('t.lead')::uuid);
do $$
begin
  perform api.undo(current_setting('t.req')::uuid);
exception when others then
  perform test.fail(format('Full on Finance undoes it past the window, with only View on Pipeline — %s', sqlerrm));
end
$$;
select test.as_owner();
select test.eq((select client_identifier_id from pipeline.tender where id = current_setting('t.T1')::uuid), null::uuid,
  'the tender no longer names the client ID');
