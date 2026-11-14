-- ACH-14 — a 2024 plan opens and a 2024 achievement logs (Landing 22: the floor moves from 2025 to 2024):
-- the migration's own step, perf.plans_open_missing, opens what a department lacks for 2024 — the seven starting
-- categories in each — in one system request, never touching a plan already held, and a second run opens nothing.
-- An achievement dated in 2024 lands in its year's plan. 2023 stays refused (ACH-01). Every value is made up.
select set_config('v2.test_now', '2026-10-02 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member', 'operations')::text, true);
select set_config('t.c', test.department('commercial')::text, true);
select set_config('t.o', test.department('operations')::text, true);

-- the two departments the test opened have no 2024 plan yet, so the missing step opens both
select test.eq(perf.plans_open_missing(array[2024]), 2,
               'the missing two are opened: Commercial 2024 and Operations 2024');
select test.eq((select count(*)::int from core.department d
                where d.deleted_at is null and perf.plan_of(d.id, 2024) is null), 0,
               'every department has its 2024 plan');
select test.eq(perf.plans_open_missing(array[2024]), 0, 'a second run opens nothing');
select test.eq((select count(*)::int from perf.achievement_category c join perf.plan p on p.id = c.plan_id
                where p.department_id = current_setting('t.o')::uuid and p.year = 2024
                  and c.deleted_at is null and c.active), 7,
               'the seven starting categories in the 2024 plan');
select set_config('t.p24', perf.plan_of(current_setting('t.o')::uuid, 2024)::text, true);

-- a 2024 achievement logs, and lands in the 2024 plan
select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.a24', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up 2024 award',
  'happened_on', '2024-06-15')) ->> 'id', true);
select test.eq((api.achievement(current_setting('t.a24')::uuid) ->> 'plan_id'), current_setting('t.p24'),
               'a 2024 achievement lands in the 2024 plan');
select test.ok((api.achievement(current_setting('t.a24')::uuid) ->> 'number') like 'ACH-2024-%',
               'numbered in the year it happened');

-- a 2024 plan opens by the door for a department that lacks one: open, then it is held
select test.as_owner();
select test.eq(perf.plans_open_missing(array[2024]), 0, 'still nothing missing for 2024');
