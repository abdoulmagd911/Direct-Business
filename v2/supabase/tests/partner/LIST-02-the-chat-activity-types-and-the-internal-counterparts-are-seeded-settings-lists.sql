-- LIST-02 — what V645 asks of Settings, as data only: the activity types WhatsApp, Email and Ticket sit in the same list
-- as call, meeting, demo, visit, note and decision (an admin renames or retires them like any other); the internal
-- counterparts — Operations, Product, Website and app developers, Support — are a Settings list of their own, in that
-- order, each with both names; everyone signed in reads them, only an admin changes them; nothing else in the lists
-- moved. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-internal-counterparts-lose-a-team.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select test.eq((select array_agg(x ->> 'key' order by (x ->> 'sort')::int) from jsonb_array_elements(api.list('activity_type')) x),
  array['call', 'meeting', 'demo', 'visit', 'note', 'decision', 'whatsapp', 'email', 'ticket'],
  'the activity types: the old six, then WhatsApp, Email and Ticket');
select test.eq((select array_agg(x ->> 'name_en' order by (x ->> 'sort')::int)
                from jsonb_array_elements(api.list('internal_counterpart')) x),
  array['Operations', 'Product', 'Website and app developers', 'Support'],
  'the internal list: Operations, Product, Website and app developers, Support, in that order');
select test.ok(not exists (select 1 from jsonb_array_elements(api.list('internal_counterpart')) x
                           where coalesce(x ->> 'name_ar', '') = '' or coalesce(x ->> 'name_en', '') = ''),
  'every internal counterpart has both names');
select test.ok(not exists (select 1 from jsonb_array_elements(api.list('activity_type')) x
                           where x ->> 'key' in ('whatsapp', 'email', 'ticket') and coalesce(x ->> 'name_ar', '') = ''),
  'the new activity types have both names too');
select test.raises($$select api.list_save('internal_counterpart', null, '{"key": "made_up", "name_en": "Made up", "name_ar": "متخيل"}')$$,
  '42501', 'only an admin changes the internal list', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.id', api.list_save('internal_counterpart', null,
  '{"key": "made_up_team", "name_en": "Made up team", "name_ar": "فريق متخيل"}') ->> 'id', true);
select test.ok(exists (select 1 from jsonb_array_elements(api.list('internal_counterpart')) x
                       where x ->> 'id' = current_setting('t.id')), 'an admin adds an internal counterpart in Settings');
select set_config('t.wa', (select x ->> 'id' from jsonb_array_elements(api.list('activity_type')) x where x ->> 'key' = 'whatsapp'), true);
select test.ok(api.list_save('activity_type', current_setting('t.wa')::uuid,
  '{"name_en": "WhatsApp message", "name_ar": "رسالة واتساب"}', (select (x ->> 'version')::int from jsonb_array_elements(api.list('activity_type')) x where x ->> 'key' = 'whatsapp')) is not null,
  'an admin renames WhatsApp like any other type');
