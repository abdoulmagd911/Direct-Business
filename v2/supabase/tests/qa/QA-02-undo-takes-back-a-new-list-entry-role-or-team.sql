-- QA-02 — Undo takes back what was just added (D7; V61 "an activity timeline with Undo on every record"; V128): a new
-- setting-list entry, role or team is retired by its Undo — never refused. Written by the QA auditor to fail until it is
-- built: on v2/main at 72577fa each Undo raises undo.cannot_remove, because audit.revert_change soft-removes an insert
-- only through deleted_at, and the list tables, core.role and core.team retire with active = false instead.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-02. Made-up values only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('qa_two')::text, true);
select test.as_person(current_setting('t.admin')::uuid);

select set_config('t.r1', api.list_save('segment', null,
  '{"key": "made_up_segment", "name_en": "Made up", "name_ar": "مختلق"}', null, 'made up') ->> 'request_id', true);
select test.runs(format('select api.undo(%L)', current_setting('t.r1')), 'the Undo of a new segment runs');
select test.as_owner();
select test.eq((select active from partner.segment where key = 'made_up_segment'), false, 'and retires the segment');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r2', api.role_save(null, 'made_up_role', 'Made up role', 'دور مختلق', 60, null, 'made up')
  ->> 'request_id', true);
select test.runs(format('select api.undo(%L)', current_setting('t.r2')), 'the Undo of a new role runs');
select test.as_owner();
select test.eq((select active from core.role where key = 'made_up_role'), false, 'and retires the role');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r3', api.team_save(null, current_setting('t.dep')::uuid, 'made_up_team', 'Made up team', null, null,
  null, 'made up') ->> 'request_id', true);
select test.runs(format('select api.undo(%L)', current_setting('t.r3')), 'the Undo of a new team runs');
select test.as_owner();
select test.eq((select active from core.team where code = 'made_up_team'), false, 'and retires the team');
