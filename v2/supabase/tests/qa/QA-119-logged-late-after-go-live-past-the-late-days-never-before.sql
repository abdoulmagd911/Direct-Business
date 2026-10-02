-- QA-119 — "Logged late" after go-live, past the late days, never before go-live (V400, V150; the scenario catalogue's
-- WRK-047 and PRF-142): with no go-live date nothing is late; once an admin sets go-live (Settings → App), an entry
-- logged 15 days after it happened is marked logged late on the timeline and one logged 14 days after is not
-- (work.late_days 14: late means more than 14); an entry dated on the go-live day counts, one dated before go-live
-- never does, even 40 days late; the days are Riyadh days (logged 00:30 Riyadh, still the evening before in UTC, is the
-- next day). Written by the QA auditor because the catalogue found only the not-late branch tested (ACT-01, today).
-- Guards: passes on v2/main today and goes red when core.logged_late loses its go-live clause, counts 14 days as late,
-- or counts days in UTC. Tasks and task updates take the same rule when they are built (P5-1); not asked here.
-- Made-up values only (V101 shapes).
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.m', test.person('Test Member', 'member')::text, true);
select set_config('t.today', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA119', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);

select test.as_person(current_setting('t.m')::uuid);
select set_config('t.n15', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: fifteen days on',
  current_setting('t.today')::date - 15) ->> 'id', true);
select set_config('t.n14', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: fourteen days on',
  current_setting('t.today')::date - 14) ->> 'id', true);
select set_config('t.n40', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: before go-live',
  current_setting('t.today')::date - 40) ->> 'id', true);
select set_config('t.ngl', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: on go-live day',
  current_setting('t.today')::date - 30) ->> 'id', true);
select set_config('t.n0', api.note_add('partner', current_setting('t.p')::uuid, 'update', 'made up: today')
  ->> 'id', true);
select test.eq((select count(*)::int from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where (n ->> 'logged_late')::boolean), 0, 'before go-live is set, nothing is logged late');

select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb((current_setting('t.today')::date - 30)::text), null,
  'made up: go-live thirty days ago');

select test.as_person(current_setting('t.m')::uuid);
select set_config('t.late', (select jsonb_object_agg(n ->> 'id', (n ->> 'logged_late')::boolean)
                             from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n)::text, true);
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.n15'))::boolean, true,
  'after go-live, an update logged 15 days after it happened is logged late');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.n14'))::boolean, false,
  'one logged 14 days after is not (late means more than work.late_days)');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.ngl'))::boolean, true,
  'an entry dated on the go-live day counts');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.n40'))::boolean, false,
  'an entry dated before go-live is never late, even logged 40 days after');
select test.eq((current_setting('t.late')::jsonb ->> current_setting('t.n0'))::boolean, false,
  'nor is today''s');

-- Riyadh days: 00:30 in Riyadh on the 15th day is still the 14th day's evening in UTC
select test.as_owner();
select set_config('t.d', (current_setting('t.today')::date - 20)::text, true);
select test.eq(core.logged_late(current_setting('t.d')::date,
                                ((current_setting('t.d')::date + 15)::text || ' 00:30:00+03')::timestamptz), true,
  'logged at 00:30 Riyadh on the 15th day is late');
select test.eq(core.logged_late(current_setting('t.d')::date,
                                ((current_setting('t.d')::date + 14)::text || ' 23:59:00+03')::timestamptz), false,
  'logged at 23:59 Riyadh on the 14th day is not');
