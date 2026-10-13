-- RPT-02 — correction (§3.9): an issued report is corrected through a correcting draft that starts as its lines, says
-- why, and on issue takes the number with -C1 and marks the old one superseded — both stay readable, the old one
-- pointing at its correction. Only one correction is open at a time; a correction of the correction is -C2; and the
-- period never holds a second report of its own beside them. Days come from the database's own clock. Every value is
-- made up.
-- Sabotage: supabase/tests/sabotage/a-correction-leaves-the-old-one-issued.sql.
select set_config('t.m', (date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.head', test.person('Test Report Head', 'head')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.report_create('monthly', current_setting('t.m')::date) ->> 'id', true);
select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges', 'kind', 'note',
  'text_ar', 'ملاحظة مختلقة أولى'));
select set_config('t.n0', api.report_issue(current_setting('t.r')::uuid, 2) ->> 'number', true);

select test.raises($$select api.report_correct(current_setting('t.r')::uuid, ' ')$$, 'P0001',
  'a correction says why', 'report.correction_says_why');
select set_config('t.c1', api.report_correct(current_setting('t.r')::uuid, 'Made-up: a wrong note') ->> 'id', true);
select test.raises($$select api.report_correct(current_setting('t.r')::uuid, 'Made-up again')$$, 'P0001',
  'one correction open at a time', 'report.correction_open');
select test.eq(jsonb_array_length(api.report(current_setting('t.c1')::uuid) -> 'lines'), 1,
  'the correcting draft starts as the issued report''s lines');
select test.raises($$select api.report_create('monthly', current_setting('t.m')::date)$$, 'P0001',
  'the period holds no second report of its own', 'report.already_issued');

select set_config('t.n1', api.report_issue(current_setting('t.c1')::uuid,
  (api.report(current_setting('t.c1')::uuid) ->> 'version')::int) ->> 'number', true);
select test.eq(current_setting('t.n1'), current_setting('t.n0') || '-C1', 'the correction is -C1');
select test.eq(api.report(current_setting('t.r')::uuid) ->> 'status', 'superseded', 'the old one is superseded');
select test.eq(api.report(current_setting('t.r')::uuid) -> 'superseded_by' ->> 'number', current_setting('t.n1'),
  'and points at its correction');
select test.ok(api.report(current_setting('t.r')::uuid) -> 'body' is not null, 'and stays readable');

select set_config('t.c2', api.report_correct(current_setting('t.c1')::uuid, 'Made-up: once more') ->> 'id', true);
select test.eq(api.report_issue(current_setting('t.c2')::uuid,
  (api.report(current_setting('t.c2')::uuid) ->> 'version')::int) ->> 'number', current_setting('t.n0') || '-C2',
  'a correction of the correction is -C2');
