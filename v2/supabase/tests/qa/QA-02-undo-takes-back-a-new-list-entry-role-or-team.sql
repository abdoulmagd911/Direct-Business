-- QA-02 — Undo takes back what was just added (D7; V61 "an activity timeline with Undo on every record"; V128): a new
-- setting-list entry, role or team is retired by its Undo — never refused. Written by the QA auditor to fail until it is
-- built: on v2/main at 72577fa each Undo raises undo.cannot_remove, because audit.revert_change soft-removes an insert
-- only through deleted_at, and the list tables, core.role and core.team retire with active = false instead. Either way
-- of taking it back passes (removed or retired), so the test holds the rule, not one way of building it (round 2).
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-02. Made-up values only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('qa_two')::text, true);
select test.as_person(current_setting('t.admin')::uuid);

select set_config('t.r1', api.list_save('side_type', null,
  '{"side": "client", "key": "made_up_segment", "name_en": "Made up", "name_ar": "مختلق"}', null, 'made up') ->> 'request_id', true);
select test.runs(format('select api.undo(%L)', current_setting('t.r1')), 'the Undo of a new segment runs');
select test.as_owner();
select test.eq((select not active or (to_jsonb(x) ->> 'deleted_at') is not null from partner.side_type x where key = 'made_up_segment'),
  true, 'and takes the segment back (retired or removed)');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r2', api.role_save(null, 'made_up_role', 'Made up role', 'دور مختلق', 60, null, 'made up')
  ->> 'request_id', true);
select test.runs(format('select api.undo(%L)', current_setting('t.r2')), 'the Undo of a new role runs');
select test.as_owner();
select test.eq((select not active or (to_jsonb(x) ->> 'deleted_at') is not null from core.role x where key = 'made_up_role'),
  true, 'and takes the role back (retired or removed)');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r3', api.team_save(null, current_setting('t.dep')::uuid, 'made_up_team', 'Made up team', 'فريق مختلق',
  null, null, 'made up') ->> 'request_id', true);
select test.runs(format('select api.undo(%L)', current_setting('t.r3')), 'the Undo of a new team runs');
select test.as_owner();
select test.eq((select not active or (to_jsonb(x) ->> 'deleted_at') is not null from core.team x where code = 'made_up_team'),
  true, 'and takes the team back (retired or removed)');
