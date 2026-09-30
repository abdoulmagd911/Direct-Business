-- LATE-01 — "logged late" is judged by work.late_days as it stood on the day the entry was logged (PRF-143): the
-- setting is effective-dated, so a stricter value from today never turns yesterday's entries late. Made up.
-- Sabotage: supabase/tests/sabotage/logged-late-by-todays-rule.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb((core.riyadh_today() - 100)::text), null, 'made up: live');
select api.setting_set('work.late_days', null, '3', core.riyadh_today(), 'made up: stricter from today');
select test.as_owner();
select test.eq(core.logged_late(core.riyadh_today() - 10, now() - interval '1 day'), false,
  'logged yesterday, nine days after it happened: fine under the 14 days in force then');
select test.eq(core.logged_late(core.riyadh_today() - 5, now()), true,
  'logged today, five days after: late under today''s 3');
