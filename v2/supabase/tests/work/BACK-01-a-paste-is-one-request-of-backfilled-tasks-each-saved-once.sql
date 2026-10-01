-- BACK-01 — the Past work grid's door (V400, V491, V504, V506; OLD-PRF-045). One paste is one request of Backfilled
-- tasks: each with its day — an undated row takes the source report's last day — the report as its evidence, its owner
-- or Unknown; none tells anyone or is ever "logged late"; a key already held is left out and named, so the same paste
-- twice adds nothing; a row before 1 January 2025 is refused by its index; a member backfills only their own rows; one
-- Undo takes the paste back. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-pasted-row-saved-twice.sql, an-undated-row-dated-today.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Backfill Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.req', jsonb_build_object('mode', 'tasks', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'bd_monthly', 'period', '2025-03', 'last_day', '2025-03-31'),
  'rows', jsonb_build_array(
    jsonb_build_object('title', 'Made-up March visit', 'happened_on', '2025-03-10', 'person_id', current_setting('t.am1'),
                       'organisation_id', current_setting('t.p'), 'import_key', 'made-up-key-1'),
    jsonb_build_object('title', 'Made-up undated item', 'owner_unknown', true, 'import_key', 'made-up-key-2'),
    jsonb_build_object('title', 'Made-up still open', 'happened_on', '2025-03-20', 'kind', 'in_progress',
                       'import_key', 'made-up-key-3')))::text, true);

select set_config('t.done', api.backfill_tasks(current_setting('t.req')::jsonb)::text, true);
select test.eq((current_setting('t.done')::jsonb ->> 'saved')::int, 3, 'the paste saves its three rows');
select test.as_owner();
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (select id from work.task where origin = 'backfill')), 1, 'in one request');
select test.eq((select happened_on from work.task where import_key = 'made-up-key-2'), date '2025-03-31',
  'an undated row takes the report''s last day');
select test.eq((select date_from_report from work.task where import_key = 'made-up-key-2'), true,
  'marked as the report''s date');
select test.eq((select happened_on from work.task where import_key = 'made-up-key-1'), date '2025-03-10',
  'a dated row keeps its own day');
select test.eq((select source_kind || ' ' || source_period from work.task where import_key = 'made-up-key-1'),
  'bd_monthly 2025-03', 'each row keeps its source report');
select test.eq((select owner_id from work.task where import_key = 'made-up-key-2'), null::uuid, 'an Unknown owner stays');
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.done')::jsonb ->> 'request_id')::uuid), 0, 'nobody is told');
select test.eq((select (work.task_flags(t) ->> 'logged_late')::boolean from work.task t where t.import_key = 'made-up-key-1'),
  false, 'and nothing is logged late');
select test.eq((select s.meaning from work.task t join work.task_status s on s.id = t.status_id
                where t.import_key = 'made-up-key-1'), 'done', 'a row with no status is done work');

select test.as_person(current_setting('t.mgr')::uuid);
select test.eq(api.backfill_keys_held(array['made-up-key-1', 'made-up-key-9']), '["made-up-key-1"]'::jsonb,
  'the keys held are named');
select set_config('t.again', api.backfill_tasks(current_setting('t.req')::jsonb)::text, true);
select test.eq((current_setting('t.again')::jsonb ->> 'saved')::int, 0, 'the same paste twice adds nothing');
select test.eq(jsonb_array_length(current_setting('t.again')::jsonb -> 'held'), 3, 'and names what was held');

select test.raises(format('select api.backfill_tasks(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made up', 'happened_on', '2024-12-31', 'import_key', 'made-up-key-0')))),
  'P0001', 'a row before 1 January 2025 is refused', 'backfill.before_2025');
select test.raises(format('select api.backfill_tasks(%L::jsonb)', current_setting('t.req')::jsonb - 'source'),
  'P0001', 'every paste names its report', 'backfill.source_required');

select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.backfill_tasks(%L::jsonb)', jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made up', 'person_id', current_setting('t.mgr'),
                                       'import_key', 'made-up-key-5')))),
  '42501', 'a member backfills only their own rows', 'access.needs_capability');
select test.eq((api.backfill_tasks(jsonb_set(current_setting('t.req')::jsonb, '{rows}',
  jsonb_build_array(jsonb_build_object('title', 'Made-up my own', 'import_key', 'made-up-key-6')))) ->> 'saved')::int, 1,
  'their own they do');

select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.undo(%L)', current_setting('t.done')::jsonb ->> 'request_id'), 'one Undo');
select test.as_owner();
select test.eq((select count(*)::int from work.task where import_key like 'made-up-key-_' and import_key <> 'made-up-key-6'
                and deleted_at is null), 0, 'takes the paste back');
