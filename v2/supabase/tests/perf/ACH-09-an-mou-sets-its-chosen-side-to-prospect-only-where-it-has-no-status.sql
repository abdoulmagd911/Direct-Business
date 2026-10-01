-- ACH-09 — an MoU sets the side chosen on it (V521, V461): a client MoU sets the Client side to Prospect from its
-- signing day where that side has no status yet, in the same request as the achievement, through the side's own door;
-- a side that already has a status keeps it; an MoU with an organisation names its side; it is never a new client.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-mou-overwrites-a-status.sql.
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
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select id from partner.side_status_change where partner_id = current_setting('t.org')::uuid)
                   or c.row_id = (current_setting('t.a')::jsonb ->> 'id')::uuid), 1, 'in the achievement''s request');
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
