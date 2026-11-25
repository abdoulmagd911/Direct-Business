-- PCE-01 — the pace rule (Landing 54, the design session's Batch 3): pace is the actual divided by the share of the
-- target due by today — the working days passed (Sunday to Thursday, today counted) over the month's working days;
-- a rate KPI is compared with its full target; On track is 90% or more, At risk 70–89%, Behind under 70%, judged on
-- the whole percent shown. Every figure is made up.
-- Sabotage: supabase/tests/sabotage/pace-counts-the-weekend.sql, pace-ignores-the-days-passed.sql,
-- the-at-risk-band-starts-at-on-track.sql, a-rate-is-paced-by-the-days.sql.
select test.eq(perf.working_days(date '2026-11-01', date '2026-11-30'), 22, 'November 2026 has 22 working days');
select test.eq(perf.working_days(date '2026-11-01', date '2026-11-25'), 19, '19 of them have passed by the 25th, today counted');
select test.eq(perf.working_days(date '2026-11-06', date '2026-11-07'), 0, 'a Friday and a Saturday are no working days');
select test.eq(round(100 * 19 / 22.0)::int, 86, '19 of 22 is 86% of a target due');

-- a cumulative KPI: the actual over the share of the target due
select test.eq(perf.pace_pct(1950000, 2400000, 19 / 22.0), 94, 'a made-up 1,950,000 of 2,400,000 with 19 of 22 days passed is 94%');
select test.eq(perf.pace_pct(790, 1200, 19 / 22.0), 76, '790 of 1,200 is 76%');
select test.eq(perf.pace_pct(9, 20, 19 / 22.0), 52, '9 of 20 is 52%');
select test.eq(perf.pace_pct(3780, 4500, 19 / 22.0), 97, '3,780 of 4,500 is 97%');
select test.eq(perf.pace_pct(11, 22, 1), 50, 'a finished month is judged on its whole target');
-- a rate KPI: against its full target, whatever the day
select test.eq(perf.pace_pct(80, 92, 19 / 22.0, true), 87, 'a rate of 80 against 92 is 87%, not paced by the days');
select test.eq(perf.pace_pct(80, 92, 0, true), 87, 'and the same on the first day');
-- nothing to judge
select test.eq(perf.pace_pct(5, 0, 0.5), null::int, 'no target, no pace');
select test.eq(perf.pace_pct(5, 10, 0), null::int, 'nothing due yet, no pace');

-- the bands
select test.eq(perf.pace_status(100, 10, 0.5), 'on_track', '100% is On track');
select test.eq(perf.pace_status(90, 10, 0.5), 'on_track', '90% is On track');
select test.eq(perf.pace_status(89, 10, 0.5), 'at_risk', '89% is At risk');
select test.eq(perf.pace_status(70, 10, 0.5), 'at_risk', '70% is At risk');
select test.eq(perf.pace_status(69, 10, 0.5), 'behind', '69% is Behind');
select test.eq(perf.pace_status(0, 10, 0.5), 'behind', '0% is Behind');
select test.eq(perf.pace_status(null, 0, 0.5), 'not_measured', 'no target is Not measured');
select test.eq(perf.pace_status(null, 10, 0), 'not_started', 'a month with no working day passed is Not started');
select test.eq(perf.pace_status(87, 92, 0, true), 'at_risk', 'a rate is judged from the first day');
select test.eq(perf.pace_bands(), '{"on_track": 90, "at_risk": 70}'::jsonb, 'the bands are 90 and 70');
