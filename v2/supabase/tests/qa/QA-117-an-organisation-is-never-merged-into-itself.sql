-- QA-117 — An organisation is never merged into itself (V136, V149; the scenario catalogue's WRK-134): a head holding
-- clients.merge who names the same organisation as the one kept and the one merged is refused partner.merge_itself,
-- and nothing moves — the organisation is not archived, no merge is recorded and it still opens and changes. Written
-- by the QA auditor because the catalogue found the rule in code only (MRG-01 and MRG-02 merge two organisations).
-- Guards: passes on v2/main today and goes red when partner.partner_merge's merge_itself check is deleted (the
-- partner.merge table's own check then refuses with 23514, a constraint's words, not the rule's).
-- Made-up values only (V101 shapes).
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Trading QA117", "sides": [{"side": "client", "type": "corporate"}]}')
  ->> 'id', true);
select test.ok(authz.can('clients.merge'), 'the head may merge');
select test.raises(format('select api.partner_merge(%L, %L, %L)', current_setting('t.p'), current_setting('t.p'),
  'made up: the same one twice'), 'P0001', 'an organisation merged into itself is refused', 'partner.merge_itself');

select test.eq((api.partner(current_setting('t.p')::uuid) ->> 'archived_at'), null::text, 'it is not archived');
select test.eq((api.partner(current_setting('t.p')::uuid) ->> 'merged_into_id'), null::text, 'nor points anywhere');
select test.ok((api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note"}',
  (api.partner(current_setting('t.p')::uuid) ->> 'version')::int, 'made up') ->> 'request_id') is not null,
  'and still changes');
select test.as_owner();
select test.eq((select count(*)::int from partner.merge where kept_id = current_setting('t.p')::uuid
                or merged_id = current_setting('t.p')::uuid), 0, 'no merge is recorded');
