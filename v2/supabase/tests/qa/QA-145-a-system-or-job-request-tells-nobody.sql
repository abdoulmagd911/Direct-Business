-- QA-145 — A system or job request tells nobody (V129, V130; §3.3 "nobody is told of what the system wrote"; the
-- scenario catalogue's WRK-148, logged as QA-137): a made-up organisation has a Client side owned by a team member
-- and a follower; a head's change tells them both (the setup can notify); the same kind of change made inside an
-- explicit request of kind 'system' (as the registry sync and the name-key rebuild open one) and of kind 'job' (as a
-- scheduled job would) tells neither — though each request closes through audit.end() and so reaches the fan-out.
-- Written by the QA auditor because NTF-01's "what the system wrote told nobody" only covers writes made with no request
-- at all, which never reach the fan-out: deleting notify.fan_out's kind check (m26) left the suite green. Guards:
-- passes on v2/main today and goes red under m26. Made-up values only (V101 shapes).
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.own', test.person('Test Member', 'member')::text, true);
select set_config('t.fan', test.person('Test Follower', 'member')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA145', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.own')))))
  ->> 'id', true);
select test.as_person(current_setting('t.fan')::uuid);
select test.eq(api.follow('partner', current_setting('t.p')::uuid), true, 'a colleague follows the organisation');

create function pg_temp.told(p_request uuid) returns text
language sql as $$
  select coalesce(string_agg(case n.person_id when current_setting('t.own')::uuid then 'owner'
                                              when current_setting('t.fan')::uuid then 'follower' else 'someone' end,
                             ', ' order by n.person_id), 'nobody')
  from notify.notification n where n.request_id = p_request
$$;

-- a person's change: owner and follower are told, so the silence below is the rule
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.r1', api.partner_update(current_setting('t.p')::uuid, '{"notes": "made up note one"}',
  (api.partner(current_setting('t.p')::uuid) ->> 'version')::int, 'made up') ->> 'request_id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r1')::uuid
                and person_id in (current_setting('t.own')::uuid, current_setting('t.fan')::uuid)), 2,
  'a head''s change tells the owner and the follower');

-- the same change inside an explicit system request, then a job's
select set_config('t.r2', audit.begin('system', 'made_up.system_write')::text, true);
update partner.partner set notes = 'made up note two' where id = current_setting('t.p')::uuid;
select test.eq(audit.end(), current_setting('t.r2')::uuid, 'the system request closes through audit.end()');
select test.ok(exists (select 1 from audit.change where request_id = current_setting('t.r2')::uuid
                       and table_name = 'partner.partner' and row_id = current_setting('t.p')::uuid),
  'and its change is logged against the organisation');
select test.eq(pg_temp.told(current_setting('t.r2')::uuid), 'nobody', 'what the system wrote tells nobody');

select set_config('t.r3', audit.begin('job', 'made_up.job_write')::text, true);
update partner.partner set notes = 'made up note three' where id = current_setting('t.p')::uuid;
select test.eq(audit.end(), current_setting('t.r3')::uuid, 'the job request closes through audit.end()');
select test.ok(exists (select 1 from audit.change where request_id = current_setting('t.r3')::uuid
                       and table_name = 'partner.partner' and row_id = current_setting('t.p')::uuid),
  'and its change is logged against the organisation');
select test.eq(pg_temp.told(current_setting('t.r3')::uuid), 'nobody', 'what a job wrote tells nobody');
