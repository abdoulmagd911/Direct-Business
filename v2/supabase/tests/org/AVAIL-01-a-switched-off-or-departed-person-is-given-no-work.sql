-- AVAIL-01 — work goes only to people who can work here (WRK-092): a person switched off or past the day they left is
-- refused as an owner or a mention (person.unavailable); one leaving later still takes work until that day; what a
-- person already holds stays when they are switched off, for an admin to hand over. Made up.
-- Sabotage: supabase/tests/sabotage/work-goes-to-a-switched-off-person.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member', 'commercial', false)::text, true);
select set_config('t.gone', test.person('Test Departed', 'member')::text, true);
select set_config('t.later', test.person('Test Leaving Later', 'member')::text, true);
update core.person set joined_on = core.riyadh_today() - 400, left_on = core.riyadh_today() - 1
where id = current_setting('t.gone')::uuid;
update core.person set joined_on = core.riyadh_today() - 400, left_on = core.riyadh_today() + 10
where id = current_setting('t.later')::uuid;

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.partner_create(%L)', jsonb_build_object('trade_name_en', 'Made Up Nobody''s Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.off'))))),
  'P0001', 'a switched-off person is made no owner', 'person.unavailable');
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Owners Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.raises(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.gone')), 'P0001', 'nor someone past the day they left', 'person.unavailable');
select test.ok((api.partner_owner_set(current_setting('t.p')::uuid, 'client', current_setting('t.later')::uuid)) is not null,
  'someone leaving later still takes work until that day');
select test.raises(format('select api.note_add(%L, %L, %L, %L, null, %L)', 'partner', current_setting('t.p'), 'comment',
  'Made-up note', array[current_setting('t.off')::uuid]), 'P0001', 'and a switched-off person is mentioned by nobody',
  'person.unavailable');
select test.as_owner();
update core.person set can_sign_in = false where id = current_setting('t.later')::uuid;
select test.eq((select array_agg(o.person_id) from partner.side_owner o where o.partner_id = current_setting('t.p')::uuid
                and o.deleted_at is null and o.effective_to is null),
  array[current_setting('t.later')::uuid], 'what a switched-off person holds stays, for an admin to hand over');
