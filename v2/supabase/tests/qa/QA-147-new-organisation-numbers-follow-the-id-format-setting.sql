-- QA-147 — New organisation numbers follow the partner.id_format setting (V52, V97, V134; the scenario catalogue's
-- WRK-078, logged as QA-140): an organisation made under the default format is numbered DK-P and four digits; an admin
-- changes the format to a made-up prefix and six digits with a reason; the next organisation takes the new prefix and
-- width and the next number of the one all-time counter; the earlier organisation keeps the number it was given.
-- Written by the QA auditor because no test changes partner.id_format — PRT-01 only reads the default — so a number
-- hard-coded as DK-P-nnnn (m65) left the suite green. Guards: passes on v2/main today and goes red under m65.
-- Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create('{"trade_name_en": "Made Up Trading QA147 One", "sides": [{"side": "client", "type": "corporate"}]}')::text, true);
select test.ok((current_setting('t.a')::jsonb ->> 'number') ~ '^DK-P-[0-9]{4}$', 'under the default format: DK-P and four digits');
select set_config('t.n', substring(current_setting('t.a')::jsonb ->> 'number' from '([0-9]+)$'), true);

select test.as_person(current_setting('t.admin')::uuid);
select test.ok((api.setting_set('partner.id_format', null, '{"prefix": "QA-ORG", "width": 6}', null,
  'made up: a longer number') ->> 'request_id') is not null, 'an admin changes the format');
select test.as_owner();
select test.eq(core.setting_at('partner.id_format', null, core.riyadh_today()), '{"prefix": "QA-ORG", "width": 6}'::jsonb,
  'the new format is in force today');

select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.partner_create('{"trade_name_en": "Made Up Trading QA147 Two", "sides": [{"side": "client", "type": "corporate"}]}')
  ->> 'number', 'QA-ORG-' || lpad((current_setting('t.n')::int + 1)::text, 6, '0'),
  'the next organisation takes the new prefix and width, and the next number');
select test.eq(api.partner((current_setting('t.a')::jsonb ->> 'id')::uuid) ->> 'number', current_setting('t.a')::jsonb ->> 'number',
  'the earlier organisation keeps its number');
