-- FIX03-01 — a cross-team achievement is refused and not listed (FIX-03 F089, P2). Two teams in the commercial
-- department; the owner in one team logs an achievement. A member of the other team is refused the record (as not
-- there) and does not see it in the list; a member of the owner's team reads it; a manager (Full on KPIs) reads it;
-- two people with no team count as the same team, so the teamless colleagues of ACH-02 keep seeing the department's
-- achievements — but no team is not every team: a teamless member is refused a teamed owner's achievement. Every
-- value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_a', 'Test Team A', 'فريق أ'),
       (test.department('commercial'), 'test_b', 'Test Team B', 'فريق ب');
select set_config('t.own', test.person('Test Team A Owner', 'member')::text, true);
select set_config('t.peer', test.person('Test Team A Peer', 'member')::text, true);
select set_config('t.other', test.person('Test Team B Member', 'member')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.free', test.person('Test Teamless Member', 'member')::text, true);
select set_config('t.free2', test.person('Test Second Teamless Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_a')
where id in (current_setting('t.own')::uuid, current_setting('t.peer')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_b')
where id = current_setting('t.other')::uuid;
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up cross-team MoU',
  'happened_on', '2026-09-21')) ->> 'id', true);

-- the other team's member: refused the record, and the list does not show it
select test.as_person(current_setting('t.other')::uuid);
select test.raises(format('select api.achievement(%L)', current_setting('t.a')), 'P0002',
  'another team is refused the record', 'common.not_found');
select test.eq((api.achievements() ->> 'total')::int, 0, 'and the list shows them nothing');

-- the owner's own team reads it, and so does a manager
select test.as_person(current_setting('t.peer')::uuid);
select test.eq(api.achievement(current_setting('t.a')::uuid) ->> 'title', 'Made-up cross-team MoU',
  'the owner''s team reads it');
select test.eq((api.achievements() ->> 'total')::int, 1, 'and lists it');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.achievement(current_setting('t.a')::uuid) ->> 'title', 'Made-up cross-team MoU',
  'a manager reads any team''s achievement');

-- two people with no team count as the same team (ACH-02) — but no team is not every team
select test.as_person(current_setting('t.free')::uuid);
select set_config('t.fa', api.achievement_log(jsonb_build_object('category', 'MOU', 'title', 'Made-up teamless MoU',
  'happened_on', '2026-09-22')) ->> 'id', true);
select test.as_person(current_setting('t.free2')::uuid);
select test.eq(api.achievement(current_setting('t.fa')::uuid) ->> 'title', 'Made-up teamless MoU',
  'a teamless colleague reads a teamless owner''s achievement');
select test.raises(format('select api.achievement(%L)', current_setting('t.a')), 'P0002',
  'but is refused a teamed owner''s achievement', 'common.not_found');
