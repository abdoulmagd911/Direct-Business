-- QA-118 — Mentioning a switched-off person is refused, worded as switched off (V452, V150, V125; the scenario catalogue's
-- WRK-145): Omar mentions Nora, switched off, in a note on an organisation — refused P0001 with a message that says
-- switched off or gone (a key matching '%switched_off%', or `person.unavailable` — #121's key for switched off or left),
-- not note.mention_cannot_see, which tells the writer she lacks access when
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
-- Layla still owns the side, switched off as the switch does it (can_sign_in). Since #160 (LEAVE-02) nobody who holds
-- work can be switched off at all, whatever the writer (person.open_work): where that rule is in, she stays on and
-- her case cannot arise.
select test.as_owner();
do $$
begin
  update core.person set can_sign_in = false where id = current_setting('t.layla')::uuid;
  perform set_config('t.held', 'no', true);
exception when raise_exception then
  if sqlerrm <> 'person.open_work' then
    raise;
  end if;
  perform set_config('t.held', 'yes', true);
end
$$;
select current_setting('t.held') = 'yes' as held \gset
select test.as_person(current_setting('t.admin')::uuid);

select test.as_person(current_setting('t.omar')::uuid);
create function pg_temp.refusal(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'no refusal';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end
$$;
select set_config('t.r1', pg_temp.refusal(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])',
  'partner', current_setting('t.p'), 'comment', 'made up note', current_setting('t.nora'))), true);
select test.ok(current_setting('t.r1') ~ '^P0001 (person\.unavailable$|.*switched_off)',
  'a switched-off person is refused as a mention, in words that say switched off — got ' || current_setting('t.r1'));
\if :held
select test.ok(true, 'one who still owns the record cannot be switched off (LEAVE-02), so is never a switched-off mention');
\else
select set_config('t.r2', pg_temp.refusal(format('select api.note_add(%L, %L, %L, %L, null, array[%L]::uuid[])',
  'partner', current_setting('t.p'), 'comment', 'made up note', current_setting('t.layla'))), true);
select test.ok(current_setting('t.r2') ~ '^P0001 (person\.unavailable$|.*switched_off)',
  'so is one who still owns the record — got ' || current_setting('t.r2'));
\endif

select test.ok((api.note_add('partner', current_setting('t.p')::uuid, 'comment', 'made up note', null,
  array[current_setting('t.peer')::uuid]) ->> 'id') is not null, 'an active colleague is mentioned');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where kind = 'mentioned'
                and person_id in (current_setting('t.nora')::uuid, current_setting('t.layla')::uuid)), 0,
  'neither switched-off person is told');
select test.eq((select count(*)::int from notify.notification where kind = 'mentioned'
                and person_id = current_setting('t.peer')::uuid), 1, 'the active colleague is');
