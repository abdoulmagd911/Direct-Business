-- ACH-15 — an organisation's record lists its achievements (Landing 35; the owner's check of 21 Nov: "add an
-- achievement and confirm it shows on the client"). api.partner_achievements answers the achievements logged with the
-- organisation, newest first — never another organisation's, never a removed one, and no amount (an achievement's
-- value is not revenue, FIX-06 / D29). Who sees a row is the Achievements page's own rule (FIX-03): the owner's team
-- and a manager see it, another team sees none; and someone who may not open the organisation, or holds nothing on
-- KPIs, is answered an empty list. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-organisations-achievements-list-{anothers,what-the-reader-may-not-see,a-removed-one,the-oldest-first}.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_a', 'Test Team A', 'فريق أ'),
       (test.department('commercial'), 'test_b', 'Test Team B', 'فريق ب');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.own', test.person('Test Team A Owner', 'member')::text, true);
select set_config('t.peer', test.person('Test Team A Peer', 'member')::text, true);
select set_config('t.other', test.person('Test Team B Member', 'member')::text, true);
select set_config('t.blind', test.person('Test Team A No Clients', 'member')::text, true);
select set_config('t.nokpi', test.person('Test Team A No KPIs', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_a')
where id in (current_setting('t.own')::uuid, current_setting('t.peer')::uuid, current_setting('t.blind')::uuid,
             current_setting('t.nokpi')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_b')
where id = current_setting('t.other')::uuid;
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.blind')::uuid, 'clients', 'none', 'made up: no Clients access'),
       (current_setting('t.blind')::uuid, 'suppliers_partners', 'none', 'made up: no Suppliers access'),
       (current_setting('t.nokpi')::uuid, 'kpis', 'none', 'made up: no KPIs access');
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Award Org", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.q', api.partner_create('{"trade_name_en": "Made Up Other Org", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

-- the owner logs two for the organisation and one for another
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.a1', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up earlier fix',
  'happened_on', '2026-09-14', 'partner_id', current_setting('t.p'))) ->> 'id', true);
select set_config('t.a2', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up later fix',
  'happened_on', '2026-09-21', 'partner_id', current_setting('t.p'))) ->> 'id', true);
select set_config('t.b1', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up fix elsewhere',
  'happened_on', '2026-09-25', 'partner_id', current_setting('t.q'))) ->> 'id', true);
select test.eq(api.achievement(current_setting('t.a1')::uuid) ->> 'partner_id', current_setting('t.p'),
  'the achievement is saved with its organisation');

-- the record's list: the organisation's own, newest first, with what the row shows and no amount
select set_config('t.r', api.partner_achievements(current_setting('t.p')::uuid)::text, true);
select test.eq((current_setting('t.r')::jsonb ->> 'total')::int, 2,
  'the organisation''s record lists its two achievements, not another organisation''s');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,title}', 'Made-up later fix', 'newest first');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,1,title}', 'Made-up earlier fix', 'then the earlier one');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,id}', current_setting('t.a2'), 'each row is its achievement');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,number}',
  api.achievement(current_setting('t.a2')::uuid) ->> 'number', 'with its number');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,category}', 'PROBLEM', 'its category');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,happened_on}', '2026-09-21', 'its day');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,logged_by}', current_setting('t.own'), 'and who logged it');
select test.ok(not (current_setting('t.r')::jsonb #> '{rows,0}' ?| array['deal_value', 'value', 'amount', 'revenue']),
  'a row carries no amount: an achievement''s value is not revenue');
select test.eq((current_setting('t.r')::jsonb ->> 'more')::boolean, false, 'two is the whole list');
select test.eq(api.partner_achievements(current_setting('t.q')::uuid) #>> '{rows,0,title}', 'Made-up fix elsewhere',
  'the other organisation lists its own');

-- a removed achievement leaves the list
select set_config('t.a3', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up duplicate fix',
  'happened_on', '2026-09-28', 'partner_id', current_setting('t.p'))) ->> 'id', true);
select test.eq((api.partner_achievements(current_setting('t.p')::uuid) ->> 'total')::int, 3, 'a third is listed');
select api.achievements_remove(array[current_setting('t.a3')::uuid], 'Made-up duplicate');
select test.eq((api.partner_achievements(current_setting('t.p')::uuid) ->> 'total')::int, 2,
  'a removed achievement is not listed');
select test.eq(api.partner_achievements(current_setting('t.p')::uuid) #>> '{rows,0,title}', 'Made-up later fix',
  'and the list is as it was');

-- who sees them: the Achievements page's own rule
select test.as_person(current_setting('t.peer')::uuid);
select test.eq((api.partner_achievements(current_setting('t.p')::uuid) ->> 'total')::int, 2, 'the owner''s team sees them');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.partner_achievements(current_setting('t.p')::uuid) ->> 'total')::int, 2, 'a manager sees them');
select test.as_person(current_setting('t.other')::uuid);
select test.eq((api.achievements() ->> 'total')::int, 0, 'another team sees none on the Achievements page');
select test.eq(api.partner_achievements(current_setting('t.p')::uuid),
  '{"rows": [], "total": 0, "more": false}'::jsonb, 'and none on the organisation''s record');
select test.as_person(current_setting('t.nokpi')::uuid);
select test.eq(api.partner_achievements(current_setting('t.p')::uuid),
  '{"rows": [], "total": 0, "more": false}'::jsonb, 'someone with nothing on KPIs is shown none');
select test.as_person(current_setting('t.blind')::uuid);
select test.raises(format('select api.partner(%L)', current_setting('t.p')), '42501',
  'someone who may not open the organisation', 'access.needs_level');
select test.eq(api.partner_achievements(current_setting('t.p')::uuid),
  '{"rows": [], "total": 0, "more": false}'::jsonb, 'is shown none of its achievements');
select test.as_person(current_setting('t.own')::uuid);
select test.eq(api.partner_achievements(gen_random_uuid()),
  '{"rows": [], "total": 0, "more": false}'::jsonb, 'an organisation that is not there lists nothing');
select test.eq(api.partner_achievements(null),
  '{"rows": [], "total": 0, "more": false}'::jsonb, 'and so does no organisation at all');
