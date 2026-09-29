-- DATE-01 — the dates rule (V400): every request carries the day its work happened (audit.request.happened_on) beside
-- the time it was logged: today unless the command names an earlier day, never a later one. Work dated in the past —
-- a call logged the next morning, a meeting written up next week — tells nobody (neither the owners and followers nor a
-- mention), and history shows the day. Made up.
-- Sabotage: supabase/tests/sabotage/past-work-rings-the-bell.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.dep', test.department('dates_one')::text, true);
update core.department set head_person_id = current_setting('t.head')::uuid where id = current_setting('t.dep')::uuid;

-- today's work (no day named): the owner is told
select set_config('t.r1', test.act(current_setting('t.admin')::uuid, 'department.renamed')::text, true);
select test.eq(audit.happened(null), core.riyadh_today(), 'no day named is today');
update core.department set name_en = 'Dates Today' where id = current_setting('t.dep')::uuid;
select test.done();
select test.eq((select happened_on from audit.request where id = current_setting('t.r1')::uuid), core.riyadh_today(),
  'a request happened today unless it says otherwise');
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r1')::uuid
                and person_id = current_setting('t.head')::uuid), 1, 'and today''s work tells the owner');

-- work dated three days ago: logged now, told to nobody
select set_config('t.r2', test.act(current_setting('t.admin')::uuid, 'department.renamed')::text, true);
select test.eq(audit.happened(core.riyadh_today() - 3), core.riyadh_today() - 3, 'a command names an earlier day');
update core.department set name_en = 'Dates Past' where id = current_setting('t.dep')::uuid;
select test.eq(notify.push(current_setting('t.head')::uuid, 'mentioned', 'core.department',
                           current_setting('t.dep')::uuid), false, 'a mention in past-dated work tells nobody');
select test.done();
select test.eq((select happened_on from audit.request where id = current_setting('t.r2')::uuid),
  core.riyadh_today() - 3, 'the request carries the day it happened');
select test.ok((select at from audit.request where id = current_setting('t.r2')::uuid) > now() - interval '1 hour',
  'beside the time it was logged');
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r2')::uuid), 0,
  'past-dated work tells nobody');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select x ->> 'happened_on' from jsonb_array_elements(api.record_history('department',
                  current_setting('t.dep')::uuid)) x where x ->> 'request_id' = current_setting('t.r2')),
  (core.riyadh_today() - 3)::text, 'history shows the day it happened');

-- never a later day
select test.as_owner();
select set_config('t.r3', test.act(current_setting('t.admin')::uuid, 'department.renamed')::text, true);
select test.raises('select audit.happened(core.riyadh_today() + 1)', 'P0001', 'work cannot happen tomorrow',
  'common.date_in_future');
select test.done();
select test.eq((select happened_on from audit.request where id = current_setting('t.r3')::uuid), core.riyadh_today(),
  'and the refused day is not kept');
