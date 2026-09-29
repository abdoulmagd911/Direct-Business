-- QA-118 — Mentioning a switched-off person is refused, worded as switched off (V452, V150, V125; the scenario catalogue's
-- WRK-145): Omar mentions Nora, switched off, in a note on an organisation — refused P0001 with a message that says
-- switched off (matched as '%switched_off%'), not note.mention_cannot_see, which tells the writer she lacks access when
-- she has left the room; mentioning Layla, switched off but still the owner of the side, is refused the same way (V452:
-- a switched-off person can no longer be a mention, every door refuses them); neither is told; an active colleague is
-- mentioned and told as before. Written by the QA auditor to fail until built: on v2/main core.mentions_add asks only
-- core.person.active (which switching off leaves on) and then authz.can_see_as, so Nora is refused as
-- note.mention_cannot_see (a switched-off person's level is none) and Layla — who sees her own record — is accepted.
-- Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.omar', test.person('Test Member', 'member')::text, true);
select set_config('t.nora', test.person('Test Switched Off', 'member')::text, true);
select set_config('t.layla', test.person('Test Owner', 'member')::text, true);
select set_config('t.peer', test.person('Test Colleague', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA118', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.layla')))))
  ->> 'id', true);
select api.person_switch(current_setting('t.nora')::uuid, false, 'made up: switched off');
select api.person_switch(current_setting('t.layla')::uuid, false, 'made up: switched off');

select test.as_person(current_setting('t.omar')::uuid);
select test.raises(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])', 'partner',
  current_setting('t.p'), 'comment', 'made up note', current_setting('t.nora')), 'P0001',
  'a switched-off person is refused as a mention, in words that say switched off', '%switched_off%');
select test.raises(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])', 'partner',
  current_setting('t.p'), 'comment', 'made up note', current_setting('t.layla')), 'P0001',
  'so is one who still owns the record', '%switched_off%');

select test.ok((api.note_add('partner', current_setting('t.p')::uuid, 'comment', 'made up note', null,
  array[current_setting('t.peer')::uuid]) ->> 'id') is not null, 'an active colleague is mentioned');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where kind = 'mentioned'
                and person_id in (current_setting('t.nora')::uuid, current_setting('t.layla')::uuid)), 0,
  'neither switched-off person is told');
select test.eq((select count(*)::int from notify.notification where kind = 'mentioned'
                and person_id = current_setting('t.peer')::uuid), 1, 'the active colleague is');
