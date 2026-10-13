-- RPT-03 — who writes a report (V57, V79): a member with View on Reports reads the department's reports but cannot open
-- or change a draft; once named a report editor of the department they can, whatever their level; a person of another
-- department sees none of it; a period starts on its first day. Days come from the database's own clock. Every value is
-- made up.
-- Sabotage: supabase/tests/sabotage/any-reader-edits-a-report.sql.
select set_config('t.m', (date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.head', test.person('Test Report Head', 'head')::text, true);
select set_config('t.am', test.person('Test Report Member', 'member')::text, true);
select set_config('t.far', test.person('Test Far Head', 'head', 'test_other_dept')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.report_create('monthly', current_setting('t.m')::date) ->> 'id', true);
select test.raises($$select api.report_create('monthly', (current_setting('t.m')::date + 3))$$, 'P0001',
  'a period starts on its first day', 'report.period_start');

select test.as_person(current_setting('t.am')::uuid);
select test.eq(jsonb_array_length(api.reports('monthly')), 1, 'the member reads the department''s reports');
select test.raises($$select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges',
  'kind', 'note', 'text_ar', 'ملاحظة مختلقة'))$$, '42501', 'but writes nothing in them', 'report.editors_only');

select test.as_owner();
insert into report.editor (department_id, person_id, created_by)
values (test.department('commercial'), current_setting('t.am')::uuid, current_setting('t.head')::uuid);
select test.as_person(current_setting('t.am')::uuid);
select test.ok(api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges', 'kind', 'note',
  'text_ar', 'ملاحظة مختلقة')) ? 'id', 'a named editor writes the draft');

select test.as_person(current_setting('t.far')::uuid);
select test.eq(api.reports(), '[]'::jsonb, 'another department''s head sees none of it');
select test.raises($$select api.report(current_setting('t.r')::uuid)$$, 'P0002', 'nor reads it', 'common.not_found');
