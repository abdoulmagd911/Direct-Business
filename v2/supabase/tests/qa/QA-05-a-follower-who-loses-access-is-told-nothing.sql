-- QA-05 — A follower who can no longer see a record is told nothing about it (V61, V129; owner decision 29 Sep 2026: an
-- appraisal is private to the employee, their direct manager and admins). Written by the QA auditor to fail until it is
-- built: on v2/main at 72577fa notify.fan_out tells every follower, never asking again whether they may see the record,
-- so access taken away later still leaks each change's label to the old follower.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-05. Made-up people only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA5',
  'account_manager_id', current_setting('t.admin')), 'made up') ->> 'id', true);
select test.as_person(current_setting('t.mem')::uuid);
select api.follow('partner', current_setting('t.p')::uuid, true);

select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_level(current_setting('t.mem')::uuid, 'partners', 'none', 'made up: moved away');
select api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note"}', 1, 'made up');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.mem')::uuid
                and kind = 'followed_change'), 0, 'someone with no access to Partners is not told of a partner''s change');
