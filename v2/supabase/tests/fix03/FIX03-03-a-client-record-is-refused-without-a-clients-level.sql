-- FIX03-03 — a client record is refused without a Clients level (FIX-03 F127). The refusal mechanism is the record
-- read itself (partner_get refuses below 'view' on Clients); no default role is refused — the plan's R9 cell gives
-- the Viewer the record read-only, and Members work clients at Full — so the test proves the mechanism on a person
-- whose Clients level is taken away, and that a Viewer still reads the record. Which default role, if any, should be
-- refused is the coordinator's question (see the build note). Every value is made up.
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.blind', test.person('Test No Clients', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.blind')::uuid, 'clients', 'none', 'made up: no Clients access');
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Refusal Co", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

select test.as_person(current_setting('t.blind')::uuid);
select test.raises(format('select api.partner(%L)', current_setting('t.p')), '42501',
  'without a Clients level the record is refused', 'access.needs_level');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'trade_name_en', 'Made Up Refusal Co',
  'a viewer still reads the record');
