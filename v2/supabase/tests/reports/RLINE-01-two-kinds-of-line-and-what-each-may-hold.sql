-- RLINE-01 — the two kinds of line (V79, V403, V458): a Note line cites nothing and is refused with a money figure in it
-- ("use an Achievement line"); an Achievement line cites at least one achievement; an Achievement line typed in the
-- report creates its achievement, marked added from report, in one request that one Undo takes back; a line citing an
-- invoice twice counts it once; a reader without View on Finance sees the lines with no amount; issuing refuses a line
-- with no Arabic while the template prints Arabic. Days come from the database's own clock. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-note-holds-a-money-figure.sql,
-- supabase/tests/sabotage/a-reader-without-finance-sees-the-amount.sql.
select set_config('t.m', (date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.day', (current_setting('t.m')::date + 4)::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Report Head', 'head')::text, true);
select set_config('t.am', test.person('Test Report Member', 'member')::text, true);
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am')::uuid, 'finance', 'none', 'made up: no Finance');
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), date_part('year', current_setting('t.m')::date)::int);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-71', 'status', 'Fully Paid', 'created_on', current_setting('t.day'), 'total_sar', 1200)),
  now() - interval '1 day');
select set_config('t.r', api.report_create('monthly', current_setting('t.m')::date) ->> 'id', true);

-- a note: nothing cited, no money
select test.raises($$select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges',
  'kind', 'note', 'text_en', 'Made-up delay cost 1,200 SAR'))$$, 'P0001', 'a note with a money figure',
  'report.note_has_money');
select test.raises($$select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges',
  'kind', 'note', 'text_ar', 'تأخير مختلق كلّف ١٢٠٠ ريال'))$$, 'P0001', 'in Arabic too', 'report.note_has_money');
select test.raises($$select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges',
  'kind', 'achievement', 'text_en', 'Made-up claim'))$$, 'P0001', 'an Achievement line cites an achievement',
  'report.line_cites_an_achievement');

-- typed in the report: its achievement is made in the same request
select set_config('t.made', api.report_add_achievement_line(current_setting('t.r')::uuid, 'achievements_by_category',
  jsonb_build_object('category', 'AWARD', 'title', 'Made-up award typed in the report', 'happened_on', current_setting('t.day')),
  'A made-up award', null)::text, true);
select test.as_owner();
select test.eq((select a.origin || ':' || (a.origin_report_id = current_setting('t.r')::uuid)
                from perf.achievement a where a.id = (current_setting('t.made')::jsonb ->> 'achievement_id')::uuid),
  'report:true', 'the achievement is marked added from report');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in ((current_setting('t.made')::jsonb ->> 'id')::uuid,
                                   (current_setting('t.made')::jsonb ->> 'achievement_id')::uuid)),
  1, 'the line and its achievement are one request');

-- an invoice cited twice counts once
select set_config('t.inv', (select id from finance.invoice where ref = 'TX-71')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.report_line_update((current_setting('t.made')::jsonb ->> 'id')::uuid, jsonb_build_object(
  'text_ar', 'جائزة مختلقة', 'show_amount', true,
  'invoice_ids', jsonb_build_array(current_setting('t.inv'), current_setting('t.inv'))), 1);
select test.eq((api.report(current_setting('t.r')::uuid) -> 'lines' -> 0 ->> 'amount')::numeric, 1200::numeric,
  'an invoice cited twice counts once');

-- money masked for a reader without Finance (V458)
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select l -> 'amount' from jsonb_array_elements(api.report(current_setting('t.r')::uuid) -> 'body' -> 'sections') s,
                jsonb_array_elements(s -> 'lines') l where l ->> 'kind' = 'achievement'), 'null'::jsonb,
  'a reader without View on Finance sees no amount');
select test.ok((api.report(current_setting('t.r')::uuid) ->> 'money_masked')::boolean, 'and is told it is masked');

-- the template prints Arabic: a line without it is refused at issue
select test.as_person(current_setting('t.head')::uuid);
select api.report_line_add(current_setting('t.r')::uuid, jsonb_build_object('section', 'challenges', 'kind', 'note',
  'text_en', 'A made-up note in English only'));
select test.raises($$select api.report_issue(current_setting('t.r')::uuid,
  (api.report(current_setting('t.r')::uuid) ->> 'version')::int)$$, 'P0001', 'a line with no Arabic is refused at issue',
  'report.line_missing_language');

-- one Undo of a typed line takes its achievement back too
select set_config('t.made2', api.report_add_achievement_line(current_setting('t.r')::uuid, 'achievements_by_category',
  jsonb_build_object('category', 'AWARD', 'title', 'Made-up award typed by mistake', 'happened_on', current_setting('t.day')),
  null, 'جائزة مختلقة بالخطأ')::text, true);
select api.undo((current_setting('t.made2')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from perf.achievement
                where id = (current_setting('t.made2')::jsonb ->> 'achievement_id')::uuid and deleted_at is null), 0,
  'one Undo takes the line''s achievement back');
select test.eq((select count(*)::int from report.line
                where id = (current_setting('t.made2')::jsonb ->> 'id')::uuid and deleted_at is null), 0,
  'with the line');
