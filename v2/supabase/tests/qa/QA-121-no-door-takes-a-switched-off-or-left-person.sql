-- QA-121 — No door takes a switched-off or left person (V452; the scenario catalogue's OLD-015 and WRK-092; the old
-- app's tasks, projects and credited-people guards: "Owner is not an active team member"): a person switched off
-- (api.person_switch) and a leaver, who has left (left_on yesterday, still switched on), are refused by every person
-- picker the server has today — a side's owner on api.partner_create, api.partner_side_set, api.partner_owner_set and
-- api.partner_bulk_assign; a mention on api.note_add, api.activity_log and api.note_edit (the leaver still sees the
-- record; the switched-off person's refusal and its words are QA-118's); the approver on api.credit_limit_set and api.code_terms_add — and
-- each door takes an active colleague with the same call. Helpers and credited people have no door yet (tasks
-- P5-1, finance P4); they join here when built. The refusal's words are the builder's (any error; the call with an active colleague
-- proves the call itself is sound). Written by the QA auditor to fail until built (P3-8c): on v2/main
-- partner.side_owner_set_inner asks only core.person.active (which switching off leaves on; left_on is asked nowhere),
-- core.mentions_add asks active and authz.can_see_as, credit_limit_set asks only that the approver is staff and
-- code_terms_add nothing at all — so the first door, api.partner_create, names the switched-off person as a side's owner.
-- Made-up values only (V101 shapes).
create function pg_temp.refused(p_sql text, p_what text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = 'TF001' then
      raise;
    end if;
    return;
  end;
  perform test.fail(p_what || ' — expected a refusal, but the statement ran');
end
$$;
grant execute on function pg_temp.refused(text, text) to authenticated;

select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.nora', test.person('Test Switched Off', 'member')::text, true);
select set_config('t.lina', test.person('Test Leaver', 'member')::text, true);
select set_config('t.pat', test.person('Test Colleague', 'member')::text, true);
select set_config('t.today', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select api.person_switch(current_setting('t.nora')::uuid, false, 'made up: switched off');
select test.as_owner();
select set_config('t.v', (select version::text from core.person where id = current_setting('t.lina')::uuid), true);
select test.as_person(current_setting('t.admin')::uuid);
select api.person_update(current_setting('t.lina')::uuid,
  jsonb_build_object('left_on', current_setting('t.today')::date - 1), current_setting('t.v')::int, 'made up: left');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Trading QA121", "sides": [{"side": "client", "type": "corporate"}]}')
  ->> 'id', true);
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'MADEUPQA121', 'made up',
  null, '2027-01-01', '2027-06-30') ->> 'id', true);
select set_config('t.n', api.note_add('partner', current_setting('t.p')::uuid, 'comment', 'made up note') ->> 'id', true);

-- a side's owner
select pg_temp.refused(format($q$select api.partner_create(jsonb_build_object('trade_name_en', 'Made Up QA121 Two',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', %L))))$q$,
  current_setting('t.nora')), 'a new organisation''s side is not given a switched-off owner');
select pg_temp.refused(format($q$select api.partner_create(jsonb_build_object('trade_name_en', 'Made Up QA121 Three',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', %L))))$q$,
  current_setting('t.lina')), 'nor one who has left');
select test.runs(format($q$select api.partner_create(jsonb_build_object('trade_name_en', 'Made Up QA121 Four',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', %L))))$q$,
  current_setting('t.pat')), 'an active colleague is');

select pg_temp.refused(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.p'), 'supplier_partner',
  jsonb_build_object('type', 'supplier', 'owner_id', current_setting('t.nora'))),
  'a side switched on is not given a switched-off owner');
select pg_temp.refused(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.p'), 'supplier_partner',
  jsonb_build_object('type', 'supplier', 'owner_id', current_setting('t.lina'))), 'nor one who has left');

select pg_temp.refused(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.nora')), 'a side''s owner is not changed to a switched-off person');
select pg_temp.refused(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.lina')), 'nor to one who has left');

select pg_temp.refused(format('select api.partner_bulk_assign(array[%L]::uuid[], %L, %L, null)', current_setting('t.p'),
  'client', current_setting('t.nora')), 'bulk assign gives no switched-off owner');
select pg_temp.refused(format('select api.partner_bulk_assign(array[%L]::uuid[], %L, %L, null)', current_setting('t.p'),
  'client', current_setting('t.lina')), 'nor one who has left');

select test.runs(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.p'), 'supplier_partner',
  jsonb_build_object('type', 'supplier', 'owner_id', current_setting('t.pat'))), 'a side switched on takes an active colleague');
select test.runs(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.pat')), 'the owner door takes an active colleague');
select test.runs(format('select api.partner_bulk_assign(array[%L]::uuid[], %L, %L, null)', current_setting('t.p'),
  'client', current_setting('t.head')), 'bulk assign takes an active colleague');

-- a mention (the leaver still sees the organisation)
select pg_temp.refused(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])', 'partner',
  current_setting('t.p'), 'comment', 'made up note', current_setting('t.lina')), 'a note mentions nobody who has left');
select pg_temp.refused(format('select api.activity_log(%L, %L, null, null, %L, null, null, array[%L]::uuid[])',
  current_setting('t.p'), 'note', 'made up line', current_setting('t.lina')), 'nor does an activity');
select pg_temp.refused(format('select api.note_edit(%L, %L, 1, array[%L]::uuid[])', current_setting('t.n'),
  '{"body": "made up note, edited"}', current_setting('t.lina')), 'nor an edited note');
select test.runs(format('select api.note_edit(%L, %L, 1, array[%L]::uuid[])', current_setting('t.n'),
  '{"body": "made up note, edited"}', current_setting('t.pat')), 'an active colleague is mentioned');

-- an approver
select pg_temp.refused(format('select api.credit_limit_set(%L, 50000, null, %L, %L)', current_setting('t.p'),
  current_setting('t.nora'), 'made up'), 'a credit limit is not approved by a switched-off person');
select pg_temp.refused(format('select api.credit_limit_set(%L, 50000, null, %L, %L)', current_setting('t.p'),
  current_setting('t.lina'), 'made up'), 'nor by one who has left');
select test.runs(format('select api.credit_limit_set(%L, 50000, null, %L, %L)', current_setting('t.p'),
  current_setting('t.pat'), 'made up'), 'an active colleague approves one');
select pg_temp.refused(format('select api.code_terms_add(%L, null, 5, %L, %L, %L)', current_setting('t.code'),
  current_setting('t.nora'), current_setting('t.today'), '2027-01-01'),
  'a code''s terms are not approved by a switched-off person');
select pg_temp.refused(format('select api.code_terms_add(%L, null, 5, %L, %L, %L)', current_setting('t.code'),
  current_setting('t.lina'), current_setting('t.today'), '2027-01-01'), 'nor by one who has left');
select test.runs(format('select api.code_terms_add(%L, null, 5, %L, %L, %L)', current_setting('t.code'),
  current_setting('t.pat'), current_setting('t.today'), '2027-01-01'), 'an active colleague approves them');
