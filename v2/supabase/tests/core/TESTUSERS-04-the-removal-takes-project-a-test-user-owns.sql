-- TESTUSERS-04 (QA-599, V656) — The removal before go-live does not stop at a project a TEST user owns: it takes it, and the
-- people, and leaves a real person's own project alone. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-test-removal-stops-at-project.sql.
select test.department('commercial');
select test.as_owner();
select core.test_users_seed();
select set_config('t.real', test.person('Made-up Real Person', 'manager')::text, true);
select set_config('t.tm', core.test_id('person', 5)::text, true);
select set_config('t.team4', core.test_id('team', 4)::text, true);

insert into work.project (number, name, owner_id, department_id, status_id, work_type)
select core.format_number('PRJ', pg_catalog.date_part('year', core.riyadh_today())::int, core.next_number('project', pg_catalog.date_part('year', core.riyadh_today())::int)),
       'Made-up project of a TEST user', current_setting('t.tm')::uuid, test.department('commercial'), (select s.id from work.project_status s limit 1), 'internal';
insert into work.project (number, name, owner_id, department_id, status_id, work_type)
select core.format_number('PRJ', pg_catalog.date_part('year', core.riyadh_today())::int, core.next_number('project', pg_catalog.date_part('year', core.riyadh_today())::int)),
       'Made-up project of a real person', current_setting('t.real')::uuid, test.department('commercial'), (select s.id from work.project_status s limit 1), 'internal';
select core.test_users_remove();
select test.eq((select count(*)::int from core.person p where p.id in (select core.test_id('person', k) from generate_series(1, 6) k) and p.deleted_at is null), 0, 'the removal went through: no TEST person is live');
select test.eq((select count(*)::int from work.project x where x.owner_id = current_setting('t.tm')::uuid and x.deleted_at is null), 0, 'the TEST user''s project is removed');
select test.eq((select count(*)::int from work.project x where x.owner_id = current_setting('t.real')::uuid and x.deleted_at is null), 1, 'a real person''s project stays');
