-- ACH-09 — an MoU sets the side chosen on it (V521, V461, V601): a client MoU sets the Client side to Prospect from its
-- signing day where that side has no status yet, in the same call as the achievement, as its own entry in the log
-- ("Prospect, from MoU ACH-…", the logger as its person) — whoever logged it, a member included, whatever their rights
-- on the side (QA-512); a side that already has a status keeps it; an MoU with an organisation names its side; it is
-- never a new client. Undoing the achievement undoes the Prospect while the side is still Prospect from it, and leaves
-- a side that has moved on alone. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-mou-overwrites-a-status.sql,
--            supabase/tests/sabotage/a-members-mou-is-refused-for-the-side.sql,
--            supabase/tests/sabotage/undo-leaves-the-mou-prospect.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up MoU Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.mgr'))))) ->> 'id', true);
select test.as_owner();
-- the made-up organisation starts with no status on its Client side (read back before acting — OA34)
update partner.side_status_change set deleted_at = now() where partner_id = current_setting('t.org')::uuid;
select test.eq(partner.status_of(current_setting('t.org')::uuid, 'client'), null::text, 'no status yet');

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.achievement_log(%L::jsonb)', jsonb_build_object('category', 'MOU',
  'title', 'Made-up MoU', 'happened_on', '2026-09-15', 'partner_id', current_setting('t.org'))),
  'P0001', 'an MoU with an organisation names its side', 'achievement.side_required');
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up MoU',
  'happened_on', '2026-09-15', 'partner_id', current_setting('t.org'), 'side', 'client', 'deal_value', 50000))::text, true);
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org')::uuid, 'client'), 'prospect', 'the Client side is Prospect');
select test.eq((select effective_on from partner.side_status_change where partner_id = current_setting('t.org')::uuid
                and deleted_at is null), date '2026-09-15', 'from the signing day');
select test.eq((select s.created_by from partner.side_status_change s
                where s.partner_id = current_setting('t.org')::uuid and s.deleted_at is null),
               current_setting('t.mgr')::uuid, 'the logger is its person');
select test.eq((select r.label_key || ' ' || (r.label_args ->> 'achievement') from audit.change c
                join audit.request r on r.id = c.request_id
                where c.row_id = (select s.id from partner.side_status_change s
                                  where s.partner_id = current_setting('t.org')::uuid and s.deleted_at is null)),
               'perf.mou_prospect ' || (current_setting('t.a')::jsonb ->> 'number'), 'its own entry, naming the MoU');
select test.eq((select mou_status_id from perf.achievement where id = (current_setting('t.a')::jsonb ->> 'id')::uuid),
               (select s.id from partner.side_status_change s
                where s.partner_id = current_setting('t.org')::uuid and s.deleted_at is null),
               'the achievement keeps the Prospect it set');
select test.eq((select mou_side from perf.achievement where id = (current_setting('t.a')::jsonb ->> 'id')::uuid), 'client',
  'the side is kept on the achievement');

-- a side with a status keeps it
update partner.side_status_change set deleted_at = now() where partner_id = current_setting('t.org')::uuid;
insert into partner.side_status_change (partner_id, side, status, effective_on)
values (current_setting('t.org')::uuid, 'client', 'active', '2026-01-01');
select test.as_person(current_setting('t.mgr')::uuid);
select api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up second MoU',
  'happened_on', '2026-09-20', 'partner_id', current_setting('t.org'), 'side', 'client'));
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org')::uuid, 'client'), 'active', 'an Active side stays Active');

-- QA-512 (V601): a member logs an MoU on a side that is not theirs and has no status — it saves, and the side is Prospect
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Other Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.mgr'))))) ->> 'id', true);
select test.as_owner();
update partner.side_status_change set deleted_at = now() where partner_id = current_setting('t.org2')::uuid;
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.m', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up member MoU',
  'happened_on', '2026-09-15', 'partner_id', current_setting('t.org2'), 'side', 'client'))::text, true);
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement where id = (current_setting('t.m')::jsonb ->> 'id')::uuid), 1,
  'the member''s MoU is saved');
select test.eq(partner.status_of(current_setting('t.org2')::uuid, 'client'), 'prospect', 'and the side is Prospect');
select test.eq((select count(*)::int from partner.side_owner o where o.partner_id = current_setting('t.org2')::uuid
                and o.person_id = current_setting('t.mem')::uuid), 0, 'no owner is assigned');

-- the member undoes it: the Prospect goes with it
select test.as_person(current_setting('t.mem')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.m')::jsonb ->> 'request_id'), 'the member undoes it');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org2')::uuid, 'client'), null::text,
  'undone, the side has no status again');

-- once the side has moved on, undoing the MoU leaves it alone
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.m2', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up second member MoU',
  'happened_on', '2026-09-16', 'partner_id', current_setting('t.org2'), 'side', 'client'))::text, true);
select test.as_owner();
insert into partner.side_status_change (partner_id, side, status, effective_on)
values (current_setting('t.org2')::uuid, 'client', 'active', '2026-09-25');
select test.as_person(current_setting('t.mem')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.m2')::jsonb ->> 'request_id'), 'undone after the side moved');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org2')::uuid, 'client'), 'active', 'the side stays Active');
select test.eq((select count(*)::int from partner.side_status_change s where s.partner_id = current_setting('t.org2')::uuid
                and s.status = 'prospect' and s.deleted_at is null), 1, 'and its Prospect history stays');

-- QA-513 (V601): a draft MoU dated later sets its side to Prospect then — once, from its signing day
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org3', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Draft Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.mgr'))))) ->> 'id', true);
select test.as_owner();
update partner.side_status_change set deleted_at = now() where partner_id = current_setting('t.org3')::uuid;
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.d', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up draft MoU',
  'partner_id', current_setting('t.org3'), 'side', 'client'))::text, true);
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org3')::uuid, 'client'), null::text, 'an undated draft waits');
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.d1', api.achievement_update((current_setting('t.d')::jsonb ->> 'id')::uuid,
  '{"happened_on": "2026-09-20"}'::jsonb, 1)::text, true);
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org3')::uuid, 'client'), 'prospect', 'dated, the side is Prospect');
select test.eq((select s.effective_on from partner.side_status_change s
                where s.partner_id = current_setting('t.org3')::uuid and s.deleted_at is null), date '2026-09-20',
               'from the signing day it was given');
select test.eq((select s.note from partner.side_status_change s
                where s.partner_id = current_setting('t.org3')::uuid and s.deleted_at is null),
               'From MoU ' || (current_setting('t.d')::jsonb ->> 'number'), 'naming the MoU');
-- undoing the change that dated it takes the Prospect back
select test.as_person(current_setting('t.mem')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.d1')::jsonb ->> 'request_id'), 'the dating is undone');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org3')::uuid, 'client'), null::text,
  'undone, the dated draft''s side has no status again');
-- dated again, then re-dated: one Prospect, never a second
select set_config('t.dv', (select version from perf.achievement
                           where id = (current_setting('t.d')::jsonb ->> 'id')::uuid)::text, true);
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.d2', api.achievement_update((current_setting('t.d')::jsonb ->> 'id')::uuid,
  '{"happened_on": "2026-09-21"}'::jsonb, current_setting('t.dv')::int)::text, true);
select api.achievement_update((current_setting('t.d')::jsonb ->> 'id')::uuid, '{"happened_on": "2026-09-22"}'::jsonb,
  (current_setting('t.d2')::jsonb ->> 'version')::int);
select test.as_owner();
select test.eq((select count(*)::int from partner.side_status_change s where s.partner_id = current_setting('t.org3')::uuid
                and s.deleted_at is null), 1, 'a changed date never sets it again');

-- V601: the paste of past work never sets a side's status, not even when its MoU is later given a side
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.org4', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Past Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.mgr'))))) ->> 'id', true);
select test.as_owner();
update partner.side_status_change set deleted_at = now() where partner_id = current_setting('t.org4')::uuid;
select test.as_person(current_setting('t.mgr')::uuid);
select api.backfill_achievements(jsonb_build_object('mode', 'achievements', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'bd_monthly', 'period', '2026-04', 'last_day', '2026-04-30'),
  'rows', jsonb_build_array(jsonb_build_object('title', 'Made-up past MoU', 'happened_on', '2026-04-02',
    'kind', 'MOU', 'organisation_id', current_setting('t.org4'), 'import_key', 'made-up-past-mou-1'))));
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org4')::uuid, 'client'), null::text, 'a pasted MoU sets no status');
select set_config('t.pv', (select jsonb_build_object('id', a.id, 'version', a.version) from perf.achievement a
                           where a.import_key = 'made-up-past-mou-1')::text, true);
select test.as_person(current_setting('t.mgr')::uuid);
select api.achievement_update((current_setting('t.pv')::jsonb ->> 'id')::uuid, '{"side": "client"}'::jsonb,
  (current_setting('t.pv')::jsonb ->> 'version')::int, 'Made-up side for past work');
select test.as_owner();
select test.eq(partner.status_of(current_setting('t.org4')::uuid, 'client'), null::text,
  'nor once its side is named');
