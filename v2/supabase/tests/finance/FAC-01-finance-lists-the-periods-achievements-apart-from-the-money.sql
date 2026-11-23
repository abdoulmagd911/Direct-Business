-- FAC-01 — the Finance page lists the achievements of the period, apart from the money (Landing 41; the owner,
-- 22 Nov: "achievements show on Finance as a separate, non-money list"). api.finance_achievements answers the
-- achievements whose day falls in the period, newest first — never one outside it, never a removed one — each with its
-- organisation and owner, and no amount at all (an achievement's value is not revenue, FIX-06 / D29). The money is
-- untouched: the period's figures read the same with and without an achievement that carries a deal value. Who sees
-- a row is the Achievements page's own rule: another team sees none, and someone with nothing on KPIs is answered an
-- empty list. Every value is made up.
-- Sabotage: supabase/tests/sabotage/finance-achievements-{of-another-period,what-the-reader-may-not-see,the-oldest-first}.sql.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_a', 'Test Team A', 'فريق أ'),
       (test.department('commercial'), 'test_b', 'Test Team B', 'فريق ب');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.own', test.person('Test Team A Owner', 'member')::text, true);
select set_config('t.other', test.person('Test Team B Member', 'member')::text, true);
select set_config('t.nokpi', test.person('Test Team A No KPIs', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_a')
where id in (current_setting('t.own')::uuid, current_setting('t.nokpi')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_b') where id = current_setting('t.other')::uuid;
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.nokpi')::uuid, 'kpis', 'none', 'made up: no KPIs access');
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Award Org", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

-- the money of September, before any achievement
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.money', api.finance_counted_by_month('2026-09-01', '2026-09-30')::text, true);

-- the owner logs two in September and one in August
select set_config('t.a1', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up earlier fix',
  'happened_on', '2026-09-14', 'partner_id', current_setting('t.p'))) ->> 'id', true);
select set_config('t.a2', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up later fix',
  'happened_on', '2026-09-21', 'partner_id', current_setting('t.p'))) ->> 'id', true);
select set_config('t.a0', api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up August fix',
  'happened_on', '2026-08-30', 'partner_id', current_setting('t.p'))) ->> 'id', true);

-- the list of September: its two, newest first, each with what the row shows and no amount
select set_config('t.r', api.finance_achievements('2026-09-01', '2026-09-30')::text, true);
select test.eq((current_setting('t.r')::jsonb ->> 'total')::int, 2, 'Finance lists the period''s two achievements, not August''s');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,title}', 'Made-up later fix', 'newest first');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,1,title}', 'Made-up earlier fix', 'then the earlier one');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,id}', current_setting('t.a2'), 'each row is its achievement');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,happened_on}', '2026-09-21', 'with its day');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,partner_en}', 'Made Up Award Org', 'its organisation');
select test.eq(current_setting('t.r')::jsonb #>> '{rows,0,owner_en}', 'Test Team A Owner', 'and who owns it');
select test.ok(not (current_setting('t.r')::jsonb #> '{rows,0}' ?| array['deal_value', 'value', 'amount', 'revenue', 'cost', 'profit']),
  'a row carries no amount: an achievement is not money');
select test.eq((api.finance_achievements('2026-08-01', '2026-08-31') ->> 'total')::int, 1, 'August lists its own one');
select test.eq((api.finance_achievements('2026-10-01', '2026-10-31') ->> 'total')::int, 0, 'a period with none is an empty list');
select test.raises($$select api.finance_achievements('2026-09-30', '2026-09-01')$$, 'P0001', 'a period that ends before it starts is refused', 'common.invalid');

-- the money is untouched by them
select test.eq(api.finance_counted_by_month('2026-09-01', '2026-09-30'), current_setting('t.money')::jsonb,
  'the period''s money reads exactly as it did before the achievements');

-- a removed one is not listed
select api.achievements_remove(array[current_setting('t.a1')::uuid], 'made up: logged twice');
select test.eq((api.finance_achievements('2026-09-01', '2026-09-30') ->> 'total')::int, 1, 'a removed achievement is not listed');

-- who sees what: the Achievements page's own rule
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.finance_achievements('2026-09-01', '2026-09-30') ->> 'total')::int, 1, 'a manager sees the team''s');
select test.as_person(current_setting('t.other')::uuid);
select test.eq((api.finance_achievements('2026-09-01', '2026-09-30') ->> 'total')::int, 0, 'another team sees none of them');
select test.as_person(current_setting('t.nokpi')::uuid);
select test.eq(api.finance_achievements('2026-09-01', '2026-09-30') - 'from' - 'to', '{"rows": [], "total": 0, "more": false}'::jsonb,
  'someone with nothing on KPIs is answered an empty list');
