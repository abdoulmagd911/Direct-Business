-- HAND-01 — a side changes hands (V488, V456): the new owner is told; the previous owner, who owned it since before
-- that day, follows the organisation for work.handover_follow_days (30) and the nightly job then ends the follow —
-- unless they follow it themselves, which keeps it; a same-day correction of the owner is no hand-over; 0 turns the
-- follow off. Every value is made up.
-- Sabotages: supabase/tests/sabotage/the-previous-owner-is-forgotten.sql,
--            supabase/tests/sabotage/a-new-side-owner-is-not-told.sql,
--            supabase/tests/sabotage/handover-follows-never-end.sql,
--            supabase/tests/sabotage/a-kept-follow-ends-with-the-handover.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Previous Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test New Owner', 'member')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Handover One',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.r', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Handover Two',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Same Day',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am1')::uuid
                and kind = 'assigned' and entity_table = 'partner.partner'), 3, 'named the owner, they are told');
update partner.side_owner set effective_from = core.riyadh_today() - 60
where partner_id in (current_setting('t.p')::uuid, current_setting('t.r')::uuid) and deleted_at is null;

-- the hand-over: the new owner told, the previous one following for thirty days
select test.as_person(current_setting('t.head')::uuid);
select api.partner_owner_set(current_setting('t.p')::uuid, 'client', current_setting('t.am2')::uuid);
select api.partner_owner_set(current_setting('t.r')::uuid, 'client', current_setting('t.am2')::uuid);
select api.partner_owner_set(current_setting('t.q')::uuid, 'client', current_setting('t.am2')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and kind = 'assigned' and entity_table = 'partner.partner'), 3, 'the new owner is told of each');
select test.eq((select jsonb_object_agg(entity_id::text, until_on) from notify.follow
                where person_id = current_setting('t.am1')::uuid and entity_table = 'partner.partner'),
  jsonb_build_object(current_setting('t.p'), core.riyadh_today() + 30, current_setting('t.r'), core.riyadh_today() + 30),
  'the previous owner follows both for thirty days; a same-day correction is no hand-over');
select test.as_person(current_setting('t.am1')::uuid);
select test.ok(api.following('partner', current_setting('t.p')::uuid), 'and sees it as followed');
select api.follow('partner', current_setting('t.r')::uuid);
select test.as_owner();
select test.eq((select until_on from notify.follow where person_id = current_setting('t.am1')::uuid
                and entity_id = current_setting('t.r')::uuid), null::date, 'following it themselves keeps it');

-- the nightly job ends what is over
select test.eq(notify.end_handover_follows(), 0, 'nothing ends before its day');
select set_config('v2.test_now', (now() + interval '31 days')::text, true);
select test.eq(notify.end_handover_follows(), 1, 'the day after its thirtieth, the job ends the follow');
select test.eq((select array_agg(entity_id) from notify.follow where person_id = current_setting('t.am1')::uuid),
  array[current_setting('t.r')::uuid], 'the one they keep stays');
select set_config('v2.test_now', '', true);

-- 0 turns it off
insert into core.setting (key, department_id, value, valid_from, reason)
values ('work.handover_follow_days', null, '0', core.riyadh_today(), 'made up for a test');
update partner.side_owner set effective_from = core.riyadh_today() - 60
where partner_id = current_setting('t.q')::uuid and deleted_at is null;
select test.as_person(current_setting('t.head')::uuid);
select api.partner_owner_set(current_setting('t.q')::uuid, 'client', current_setting('t.am1')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from notify.follow where person_id = current_setting('t.am2')::uuid), 0,
  'with the setting at 0 nobody follows after a hand-over');
