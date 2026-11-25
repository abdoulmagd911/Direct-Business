-- XTR-07 — per-member settings (Landing 51, the owner's approved design of 22 Nov 2026): a Viewer sees everything and
-- edits nothing — including Finance. One Viewer by role, and one person whose role became Viewer while their record
-- still said "Allowed" on all three extras, each try every kind of write: a task, a project, an organisation, its
-- contact, its contract, a logged activity, a note, a file, a comment, an achievement, a pipeline card, a Finance
-- entry, an exclusion, a deal type, a month close, an import through either door, and both credit limits. Each is
-- refused, and both still read Finance. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-viewer-starts-at-full-on-finance.sql (FIX03-02) covers the Finance level;
--           supabase/tests/sabotage/a-viewer-keeps-a-stray-extra.sql and
--           supabase/tests/sabotage/the-older-import-door-asks-for-the-capability-alone.sql cover the extras here.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.v', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.m', test.person('Test Member M', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.a')::uuid, current_setting('t.v')::uuid, current_setting('t.m')::uuid);

-- a member's work, for the Viewers to try
select test.as_person(current_setting('t.a')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up checklist of A')) ->> 'id', true);
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up internal tooling',
  'work_type', 'internal')) ->> 'id', true);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Xtr07 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.a'))))) ->> 'id', true);

-- the second Viewer: all three extras set while a member, then the role changed
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.m')::uuid, 'finance.import', true, 'made up: set while a member');
select api.access_set_person_capability(current_setting('t.m')::uuid, 'records.edit_others', true, 'made up: set while a member');
select api.access_set_person_capability(current_setting('t.m')::uuid, 'finance.credit_control', true, 'made up: set while a member');
select test.as_owner();
update core.person set role_id = (select id from core.role where key = 'viewer') where id = current_setting('t.m')::uuid;

-- every write, as each of the two
create temporary table xtr07_try (what text, sql text) on commit drop;
grant select on xtr07_try to public;
insert into xtr07_try values
  ('add a task', $$select api.task_create('{"title": "Made-up viewer task"}'::jsonb)$$),
  ('change a task', format('select api.task_update(%L, %L::jsonb, 1)', current_setting('t.t'), '{"title": "Made up"}')),
  ('remove a task', format('select api.tasks_remove(array[%L]::uuid[], %L)', current_setting('t.t'), 'made up')),
  ('add a project', $$select api.project_save(null, '{"name": "Made up", "work_type": "internal"}'::jsonb)$$),
  ('change a project', format('select api.project_save(%L, %L::jsonb, 1)', current_setting('t.prj'), '{"name": "Made up"}')),
  ('say how a project is going', format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'at_risk', 'Made up')),
  ('remove a project', format('select api.projects_remove(array[%L]::uuid[], %L)', current_setting('t.prj'), 'made up')),
  ('add an organisation', $$select api.partner_create('{"trade_name_en": "Made Up Viewer Co", "sides": [{"side": "client", "type": "corporate"}]}'::jsonb)$$),
  ('change an organisation', format('select api.partner_update(%L, %L::jsonb, 1, %L)', current_setting('t.p'), '{"trade_name_en": "Made Up Renamed"}', 'made up')),
  ('archive an organisation', format('select api.partner_archive(%L, %L)', current_setting('t.p'), 'made up')),
  ('add a contact', format('select api.contact_save(%L, null, %L::jsonb, null)', current_setting('t.p'), '{"name": "Made-up Contact"}')),
  ('add a contract', format('select api.contract_save(%L, null, %L::jsonb, null, %L)', current_setting('t.p'), '{"title": "Made up", "side": "client"}', 'made up')),
  ('add a note', format('select api.note_add(%L, %L, %L, %L, null, null)', 'partner', current_setting('t.p'), 'note', 'Made up')),
  ('add a file', format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'certificate', 'attachment', 'c.pdf', 1000, 'application/pdf')),
  ('comment on a task', format('select api.task_comment_add(%L, %L)', current_setting('t.t'), 'Made up')),
  ('log an achievement', $$select api.achievement_log('{"title": "Made up"}'::jsonb, null, null)$$),
  ('add an opportunity', $$select api.opportunity_save(null, '{"title": "Made up"}'::jsonb, null)$$),
  ('add a tender', $$select api.tender_save(null, '{"title": "Made up"}'::jsonb, null)$$),
  ('add a Finance entry', $$select api.finance_row_add('finance.invoice', '{}'::jsonb, 'made up')$$),
  ('exclude a Finance row', format('select api.finance_row_exclude(%L, %L, %L)', current_setting('t.p'), 'MADE-UP-1', 'made up')),
  ('set a deal type', format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.p'), 'MADE-UP-1', 'prepaid', 'made up')),
  ('close a month', $$select api.finance_month_close(date '2001-01-01', 'made up')$$),
  ('import through the older door', $$select api.finance_import('invoices', '[]'::jsonb, now(), 'made-up.csv', repeat('a', 64), true)$$),
  ('start an import', format('select api.import_batch_start(%L, %L, %L)', current_setting('t.p'), 'invoice_export', 'made-up.csv')),
  ('change the company-wide credit limit', $$select api.finance_credit_limit_set(1, 'made up: a viewer tries')$$),
  ('change a client''s credit limit', format('select api.credit_limit_set(%L, 1000, null, %L, %L)', current_setting('t.p'), current_setting('t.a'), 'made up'));

select test.as_person(current_setting('t.v')::uuid);
select test.raises(x.sql, '42501', 'a Viewer cannot ' || x.what) from xtr07_try x;
select test.eq(api.me() -> 'levels' ->> 'finance', 'view', 'and still reads Finance');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'and is told a task is not theirs to change');

select test.as_person(current_setting('t.m')::uuid);
select test.raises(x.sql, '42501', 'a person whose role became Viewer cannot ' || x.what || ', whatever their record still says')
from xtr07_try x;
select test.eq(api.me() -> 'levels' ->> 'finance', 'view', 'and still reads Finance');

-- nothing was written by either
select test.as_owner();
select test.eq((select count(*)::int from audit.change c join audit.request q on q.id = c.request_id
                where q.actor_id in (current_setting('t.v')::uuid, current_setting('t.m')::uuid)), 0,
  'and the log holds no change made by either Viewer');
