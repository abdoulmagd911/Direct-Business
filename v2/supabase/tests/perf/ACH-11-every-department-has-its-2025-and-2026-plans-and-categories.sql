-- ACH-11 — every department has its 2025 and 2026 plans and their categories (V380; the Architect on #151, 2 Oct):
-- the migration's own step, perf.plans_open_missing, opens what a department lacks — the seven starting categories in
-- each — in one system request, never touching a plan already held, and a second run opens nothing. The plans are what
-- Log achievement's Category list reads. Every value is made up.
-- Sabotage: supabase/tests/sabotage/plans-open-missing-opens-nothing.sql.
select set_config('v2.test_now', '2026-10-02 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member', 'operations')::text, true);
select set_config('t.c', test.department('commercial')::text, true);
select set_config('t.o', test.department('operations')::text, true);

-- a plan already held keeps its own categories: Commercial 2026 opened by an admin, one category renamed
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(current_setting('t.c')::uuid, 2026);
select test.as_owner();
update perf.achievement_category set name_en = 'Made-up awards, renamed'
where code = 'AWARD' and plan_id = perf.plan_of(current_setting('t.c')::uuid, 2026);

select test.eq(perf.plans_open_missing(array[2025, 2026]), 3,
  'the missing three are opened: Commercial 2025, Operations 2025 and 2026');
select test.eq((select count(*)::int from core.department d cross join (values (2025), (2026)) y(year)
                where d.deleted_at is null and perf.plan_of(d.id, y.year) is null), 0,
               'every department has its 2025 and 2026 plans');
select test.eq((select count(*)::int from perf.achievement_category c join perf.plan p on p.id = c.plan_id
                where p.department_id = current_setting('t.o')::uuid and c.deleted_at is null and c.active), 14,
               'the seven starting categories in each');
select test.eq((select name_en from perf.achievement_category
                where code = 'AWARD' and plan_id = perf.plan_of(current_setting('t.c')::uuid, 2026)),
               'Made-up awards, renamed', 'a plan already held is left as it was');
select test.eq((select r.kind || ' ' || r.label_key from audit.request r join audit.change c on c.request_id = r.id
                where c.table_name = 'perf.plan'
                  and c.row_id = perf.plan_of(current_setting('t.o')::uuid, 2025)),
               'system plan.opened_missing', 'opened by the system, in its own request');
select test.eq(perf.plans_open_missing(array[2025, 2026]), 0, 'a second run opens nothing');
select test.eq((select count(*)::int from perf.plan where deleted_at is null), 4, 'and duplicates nothing');

-- the member's Category list for this year now reads the department's categories
select test.as_person(current_setting('t.mem')::uuid);
select test.eq(jsonb_array_length(api.achievement_categories(null, 2026)), 7, 'Log achievement has its categories');
