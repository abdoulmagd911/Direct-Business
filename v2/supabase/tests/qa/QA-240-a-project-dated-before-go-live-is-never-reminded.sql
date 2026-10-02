-- QA-240 — A project dated before the go-live day is past work and is never reminded (V491, V506 as #140 wrote them:
-- "work dated before the go-live day, and every backfilled entry, is past work: no notices"; V199). A task dated before
-- go-live and due tomorrow is not reminded (ALR-03); a project of the same date, still Active, must not be either.
-- Written by the QA auditor to fail until it is fixed: on #141 at f2733e5 notify.alert_project_no_update() never asks
-- work.is_past, so a project made with a January date tells its owner "no health update" on the first daily run.
-- Passes on v2/main (no project reminder yet). Finding: docs/v2/QA-LOG.md, 2026-10-02, QA-240. Made-up values only.
select set_config('v2.test_now', now()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.pm', test.person('Test Project Owner', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.pm')::uuid;

select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb((core.riyadh_today() - 30)::text), null,
  'made up: go-live thirty days ago');
select test.as_person(current_setting('t.pm')::uuid);
select set_config('t.past', api.project_save(null, jsonb_build_object('name', 'Made-up January project',
  'work_type', 'internal', 'happened_on', core.riyadh_today() - 90)) ->> 'id', true);
select set_config('t.live', api.project_save(null, jsonb_build_object('name', 'Made-up live project',
  'work_type', 'internal', 'happened_on', core.riyadh_today() - 20)) ->> 'id', true);

select test.as_owner();
select test.eq((select work.is_past(happened_on) from work.project where id = current_setting('t.past')::uuid), true,
  'a project dated before go-live is past work');
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.pm')::uuid
                and entity_id = current_setting('t.past')::uuid), 0,
  'past work tells nobody: the project dated before go-live is never reminded');
