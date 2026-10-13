-- RPT-01 — issue (§3.9; OLD-052, OLD-PRF-069): an editor opens last month's draft, writes an Achievement line and a Note
-- line in Arabic, and issues it: it takes its number (<DEPT>-M-YYYY-MM), its snapshot and the snapshot's SHA-256, and
-- the snapshot holds the lines with the cited achievement's number and date. An issued report never changes: a line edit
-- is refused, a second Issue answers "Already issued as <number>", and it is never removed. Changing the cited
-- achievement afterwards changes neither the snapshot nor its hash. Days come from the database's own clock. Every value
-- is made up.
-- Sabotages: supabase/tests/sabotage/an-issued-report-takes-a-line-edit.sql,
-- supabase/tests/sabotage/a-second-issue-gets-a-second-answer.sql.
select set_config('t.m', (date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.day', (current_setting('t.m')::date + 4)::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Report Head', 'head')::text, true);
select set_config('t.am', test.person('Test Report Member', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), date_part('year', current_setting('t.m')::date)::int);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up industry award',
  'happened_on', current_setting('t.day'))) ->> 'id', true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r', api.report_create('monthly', current_setting('t.m')::date) ->> 'id', true);
select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'achievements_by_category',
  'kind', 'achievement', 'text_ar', 'جائزة مختلقة في القطاع', 'text_en', 'A made-up industry award',
  'achievement_ids', jsonb_build_array(current_setting('t.a'))));
select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges', 'kind', 'note',
  'text_ar', 'ملاحظة مختلقة عن الشهر'));
select set_config('t.issued', api.report_issue(current_setting('t.r')::uuid,
  (api.report(current_setting('t.r')::uuid) ->> 'version')::int)::text, true);

select test.eq(current_setting('t.issued')::jsonb ->> 'number',
  'COMMERCIAL-M-' || to_char(current_setting('t.m')::date, 'YYYY-MM'), 'it takes its number');
select test.eq(current_setting('t.issued')::jsonb -> 'flags', '[]'::jsonb, 'no banned word to flag');
select test.as_owner();
select set_config('t.row', (select to_jsonb(r) from report.report r where r.id = current_setting('t.r')::uuid)::text, true);
select test.eq(current_setting('t.row')::jsonb ->> 'status', 'issued', 'it is issued');
select test.eq(current_setting('t.row')::jsonb ->> 'snapshot_sha256',
  encode(sha256(convert_to((current_setting('t.row')::jsonb -> 'snapshot')::text, 'UTF8')), 'hex'),
  'the hash is the snapshot''s SHA-256');
select test.eq((select l -> 'achievements' -> 0 ->> 'happened_on'
                from jsonb_array_elements(current_setting('t.row')::jsonb -> 'snapshot' -> 'sections') s,
                     jsonb_array_elements(s -> 'lines') l
                where l ->> 'kind' = 'achievement'), current_setting('t.day'),
  'the snapshot holds the line with its achievement''s date');

-- never changed after issue
select set_config('t.note', (select l.id from report.line l
                             where l.report_id = current_setting('t.r')::uuid and l.kind = 'note')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.report_line_update(current_setting('t.note')::uuid, '{"text_ar": "نص آخر"}'::jsonb, 1)$$,
  'P0001', 'an issued report takes no line edit', 'report.not_a_draft');
select test.raises(format($$select api.report_issue(%L::uuid, 2)$$, current_setting('t.r')), 'P0001',
  'a second Issue answers with its number', 'report.already_issued');
select test.raises(format($$select api.reports_remove(array[%L::uuid], 'made up')$$, current_setting('t.r')), 'P0001',
  'an issued report is never removed', 'report.issued_never_removed');

-- the cited achievement changes; the snapshot and its hash do not
select test.as_person(current_setting('t.am')::uuid);
select api.achievement_update(current_setting('t.a')::uuid, jsonb_build_object('title', 'Made-up award, renamed'),
  (api.achievement(current_setting('t.a')::uuid) ->> 'version')::int, 'made up');
select test.as_owner();
select test.eq((select r.snapshot_sha256 from report.report r where r.id = current_setting('t.r')::uuid),
  current_setting('t.row')::jsonb ->> 'snapshot_sha256', 'a later change never moves the hash');
select test.eq((select r.snapshot from report.report r where r.id = current_setting('t.r')::uuid),
  current_setting('t.row')::jsonb -> 'snapshot', 'nor the snapshot');
