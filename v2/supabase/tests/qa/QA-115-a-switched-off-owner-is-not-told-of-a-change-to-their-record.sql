-- QA-115 — A switched-off owner is not told of a change to a record they own (V129, V452; the scenario catalogue's
-- ACC-106): the owner of an organisation's side hears of a colleague's change while switched on; once an admin switches
-- them off (api.person_switch) the next change tells them nothing, though they still own the side; switched on again,
-- they hear again. Written by the QA auditor because the catalogue found no explicit case: NTF-01 switches off a
-- department's head by a raw update, never a side's owner through the switch door. Guards: passes on v2/main today and
-- goes red when notify.may_notify stops asking can_sign_in (on v2/main a switched-off owner still counts in
-- core.owners_of and authz.can_see_as lets an owner see their record whatever their switch, so may_notify is the one
-- check between them and the bell; branch v2/a-p3-8b-3 adds a second, dropping owners without View on the side's page).
-- Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.own', test.person('Test Member', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA115', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.own')))))
  ->> 'id', true);

-- switched on: the owner hears of the head's change
select test.as_owner();
select set_config('t.v', (select version::text from partner.partner where id = current_setting('t.p')::uuid), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r1', api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note one"}',
  current_setting('t.v')::int, 'made up') ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.own')::uuid
                and request_id = current_setting('t.r1')::uuid and kind = 'changed_by_other'), 1,
  'switched on, the side''s owner is told of a colleague''s change');

-- switched off: still the owner, told nothing. Set as the switch sets it (can_sign_in). Since #160 (LEAVE-02) nobody
-- who holds work can be switched off at all, whatever the writer (person.open_work): where that rule is in, a
-- switched-off owner cannot exist, and the check is that the switch is refused.
select test.as_owner();
do $$
begin
  update core.person set can_sign_in = false where id = current_setting('t.own')::uuid;
  perform set_config('t.held', 'no', true);
exception when raise_exception then
  if sqlerrm <> 'person.open_work' then
    raise;
  end if;
  perform set_config('t.held', 'yes', true);
end
$$;
select current_setting('t.held') = 'yes' as held \gset
\if :held
select test.ok(exists (select 1 from core.person where id = current_setting('t.own')::uuid and can_sign_in),
  'an owner who still holds work cannot be switched off (LEAVE-02), so no switched-off owner is ever told anything');
\else
select test.ok(exists (select 1 from partner.side_owner m where m.partner_id = current_setting('t.p')::uuid
                       and m.side = 'client' and m.person_id = current_setting('t.own')::uuid and m.deleted_at is null
                       and m.effective_to is null),
  'switching off leaves them named as the side''s owner');
select set_config('t.v', (select version::text from partner.partner where id = current_setting('t.p')::uuid), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r2', api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note two"}',
  current_setting('t.v')::int, 'made up') ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.own')::uuid
                and request_id = current_setting('t.r2')::uuid), 0,
  'a switched-off owner is not told of a change to a record they own');

-- switched on again: told again, so the silence was the switch and nothing else
select test.as_person(current_setting('t.admin')::uuid);
select api.person_switch(current_setting('t.own')::uuid, true, 'made up: back');
select test.as_owner();
select set_config('t.v', (select version::text from partner.partner where id = current_setting('t.p')::uuid), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r3', api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note three"}',
  current_setting('t.v')::int, 'made up') ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.own')::uuid
                and request_id = current_setting('t.r3')::uuid), 1, 'switched on again, they are told again');
\endif
