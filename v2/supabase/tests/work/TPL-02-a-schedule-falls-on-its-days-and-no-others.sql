-- TPL-02 — a template's schedule (TECH-SPEC §3.7): daily (on working days, not Friday or Saturday — V472), every n
-- weeks on its weekdays, monthly on its day (or the month's last day when it has no such day), quarterly and yearly from
-- its start, and never before it. Fixed dates, so the answers never move. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-daily-template-works-on-friday.sql, a-monthly-template-skips-short-months.sql.
-- 2026-10-01 is a Thursday.
select test.eq(work.occurs_on('{"freq": "daily"}', date '2026-10-01', date '2026-10-02'), true, 'daily, every day');
select test.eq(work.occurs_on('{"freq": "daily", "working_days": true}', date '2026-10-01', date '2026-10-02'), false,
  'working days: not Friday');
select test.eq(work.occurs_on('{"freq": "daily", "working_days": true}', date '2026-10-01', date '2026-10-03'), false,
  'nor Saturday');
select test.eq(work.occurs_on('{"freq": "daily", "working_days": true}', date '2026-10-01', date '2026-10-04'), true,
  'Sunday is a working day');
select test.eq(work.occurs_on('{"freq": "daily", "interval": 3}', date '2026-10-01', date '2026-10-04'), true,
  'every third day');
select test.eq(work.occurs_on('{"freq": "daily", "interval": 3}', date '2026-10-01', date '2026-10-05'), false,
  'and not between');
select test.eq(work.occurs_on('{"freq": "weekly"}', date '2026-10-01', date '2026-10-08'), true,
  'weekly, on its start''s weekday');
select test.eq(work.occurs_on('{"freq": "weekly", "weekdays": [0, 2]}', date '2026-10-01', date '2026-10-06'), true,
  'on a weekday named (Tuesday)');
select test.eq(work.occurs_on('{"freq": "weekly", "weekdays": [0, 2]}', date '2026-10-01', date '2026-10-07'), false,
  'never on one not named');
select test.eq(work.occurs_on('{"freq": "weekly", "interval": 2}', date '2026-10-01', date '2026-10-08'), false,
  'every other week: not the next');
select test.eq(work.occurs_on('{"freq": "weekly", "interval": 2}', date '2026-10-01', date '2026-10-15'), true,
  'but the one after');
select test.eq(work.occurs_on('{"freq": "monthly", "month_day": 15}', date '2026-10-01', date '2026-11-15'), true,
  'monthly on its day');
select test.eq(work.occurs_on('{"freq": "monthly", "month_day": 31}', date '2026-10-01', date '2026-11-30'), true,
  'a month without that day: its last');
select test.eq(work.occurs_on('{"freq": "monthly", "month_day": 31}', date '2026-10-01', date '2026-11-29'), false,
  'only its last');
select test.eq(work.occurs_on('{"freq": "quarterly", "month_day": 1}', date '2026-10-01', date '2027-01-01'), true,
  'quarterly from its start');
select test.eq(work.occurs_on('{"freq": "quarterly", "month_day": 1}', date '2026-10-01', date '2026-12-01'), false,
  'not in between');
select test.eq(work.occurs_on('{"freq": "yearly"}', date '2026-10-01', date '2027-10-01'), true, 'yearly on its day');
select test.eq(work.occurs_on('{"freq": "yearly"}', date '2026-10-01', date '2027-04-01'), false, 'only once a year');
select test.eq(work.occurs_on('{"freq": "daily"}', date '2026-10-01', date '2026-09-30'), false, 'never before it starts');
select test.eq(work.rule_ok('{"freq": "hourly"}'), false, 'a schedule names a known frequency');
select test.eq(work.rule_ok('{"freq": "weekly", "weekdays": [7]}'), false, 'weekdays are 0 to 6');
select test.eq(work.rule_ok('{"freq": "monthly", "month_day": 32}'), false, 'a month''s day is 1 to 31');
select test.eq(work.checklist_ok('[{"text": "Made-up row", "owner": "someone"}]'), false,
  'a checklist row is owned by the task''s owner or a person');
