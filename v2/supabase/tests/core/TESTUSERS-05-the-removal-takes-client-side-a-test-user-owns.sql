-- TESTUSERS-05 (QA-599, V656) — The removal before go-live does not stop at a client side a TEST user owns: it takes it, and the
-- people, and leaves a real person's own client-side alone. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-test-removal-stops-at-client-side.sql.
select test.department('commercial');
select test.as_owner();
select core.test_users_seed();
select set_config('t.real', test.person('Made-up Real Person', 'manager')::text, true);
select set_config('t.tm', core.test_id('person', 5)::text, true);
select set_config('t.team4', core.test_id('team', 4)::text, true);

select test.as_person(current_setting('t.real')::uuid);
select set_config('t.org', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Side Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.tm'))))) ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from partner.side_owner m where m.partner_id = current_setting('t.org')::uuid and m.person_id = current_setting('t.tm')::uuid and m.deleted_at is null), 1, 'the TEST user owns the side');
select core.test_users_remove();
select test.eq((select count(*)::int from core.person p where p.id in (select core.test_id('person', k) from generate_series(1, 6) k) and p.deleted_at is null), 0, 'the removal went through: no TEST person is live');
select test.eq((select count(*)::int from partner.side_owner m where m.person_id = current_setting('t.tm')::uuid and m.deleted_at is null), 0, 'the TEST user''s side ownership is removed');
select test.eq((select count(*)::int from partner.partner x where x.id = current_setting('t.org')::uuid and x.deleted_at is null), 1, 'the organisation itself stays');
