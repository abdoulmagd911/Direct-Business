-- CORE-01 — an instant belongs to the Riyadh calendar day it falls on, months and quarters start on their first
-- day, and "today" follows the test clock (D20; no Hijri anywhere).
-- Sabotage: supabase/tests/sabotage/days-cut-at-utc-midnight.sql.
select test.eq(core.riyadh_day('2026-09-28 20:59:59+00'), '2026-09-28'::date, 'one second before midnight in Riyadh');
select test.eq(core.riyadh_day('2026-09-28 21:00:00+00'), '2026-09-29'::date, 'midnight in Riyadh is 21:00 UTC');
select test.eq(core.riyadh_day('2026-12-31 22:00:00+00'), '2027-01-01'::date, 'the new year starts in Riyadh first');
select test.eq(core.month_of('2026-09-30'), '2026-09-01'::date, 'the month of 30 Sep');
select test.eq(core.quarter_of('2026-09-30'), '2026-07-01'::date, 'Q3 holds 30 Sep');
select test.eq(core.quarter_of('2026-10-01'), '2026-10-01'::date, 'Q4 starts on 1 Oct');
select set_config('v2.test_now', '2026-12-31 21:30:00+00', true);
select test.eq(core.clock(), '2026-12-31 21:30:00+00'::timestamptz, 'the clock reads the test clock');
select test.eq(core.riyadh_today(), '2027-01-01'::date, 'today is the test clock''s day in Riyadh');
select set_config('v2.test_now', '', true);
select test.ok(core.clock() = now(), 'without a test clock, the clock is now()');
