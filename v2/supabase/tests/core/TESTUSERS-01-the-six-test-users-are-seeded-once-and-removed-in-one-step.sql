-- TESTUSERS-01 (V656) — The six TEST users: seeded once, with their teams, notes and tasks; named TEST; none can sign in
-- by itself; the department's own head is untouched; removal takes exactly those rows in one step and is safe twice.
-- Every value is made up.
select test.department('commercial');
select test.as_owner();
select set_config('t.head_before', (select coalesce(head_person_id::text, 'none') from core.department where code = 'commercial'), true);
select set_config('t.seed', core.test_users_seed()::text, true);
select test.eq((current_setting('t.seed')::jsonb ->> 'seeded')::boolean, true, 'the seed ran');
select test.eq((select count(*)::int from core.person p where p.full_name_en like 'TEST %' and p.deleted_at is null), 6, 'six TEST people');
select test.eq((select count(*)::int from core.person_auth a join core.person p on p.id = a.person_id where p.full_name_en like 'TEST %')
              + (select count(*)::int from core.person_email e join core.person p on p.id = e.person_id where p.full_name_en like 'TEST %'),
  0, 'no e-mail and no auth user: nobody can sign in as them');
select test.eq((select count(*)::int from core.team t where t.name_en like 'TEST %'), 5, 'five TEST teams');
select test.eq((select count(*)::int from my.note n where n.title like 'TEST %' and n.visibility = 'private'), 6, 'six private notes');
select test.eq((select count(*)::int from work.task t where t.title like 'TEST %' and t.deleted_at is null), 10, 'ten tasks');
select test.eq((select r.key from core.person p join core.role r on r.id = p.role_id where p.full_name_en = 'TEST Head'), 'head', 'the Head has the head role');
select test.eq((select p.team_id is null from core.person p where p.full_name_en = 'TEST Member'), true, 'TEST Member has no team');
select test.eq((select count(distinct p.team_id)::int from core.person p where p.full_name_en like 'TEST %' and p.team_id is not null), 5, 'the others each have a team of their own');
select test.eq((select t.lead_person_id from core.team t where t.name_en = 'TEST Head team'), (select p.id from core.person p where p.full_name_en = 'TEST Head'), 'the Head leads its team');
select test.eq((select coalesce(head_person_id::text, 'none') from core.department where code = 'commercial'), current_setting('t.head_before', true), 'the department''s own head is unchanged');
select test.eq((select count(*)::int from work.task t join core.person o on o.id = t.owner_id where t.assigned_by is not null and t.title like 'TEST %'), 5, 'five tasks are given to another TEST user');
select test.eq((core.test_users_seed() ->> 'seeded')::boolean, false, 'a second seed writes nothing');
select test.eq((select count(*)::int from core.person p where p.full_name_en like 'TEST %'), 6, 'still six');

select set_config('t.removed', core.test_users_remove()::text, true);
select test.eq((current_setting('t.removed')::jsonb ->> 'people')::int, 6, 'the removal took six people');
select test.eq((select count(*)::int from core.person p where p.full_name_en like 'TEST %' and p.deleted_at is null), 0, 'none is live');
select test.eq((select count(*)::int from work.task t where t.title like 'TEST %' and t.deleted_at is null), 0, 'no TEST task is live');
select test.eq((select count(*)::int from my.note n where n.title like 'TEST %' and n.deleted_at is null), 0, 'no TEST note is live');
select test.eq((select count(*)::int from core.team t where t.name_en like 'TEST %' and t.active), 0, 'the teams are retired');
select test.eq((core.test_users_remove() ->> 'people')::int, 0, 'removing twice takes nothing more');
