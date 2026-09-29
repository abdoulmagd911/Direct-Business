-- NTF-01 — "changed by someone else" (§3.3, V61): when a person's request closes, the owner of every record it changed and
-- everyone following one are told, once per person per request (an owner's notice before a follower's), never the one
-- who made it; nobody is told of what the system wrote; a switched-off person, a kind switched off for the company and
-- a kind a person turned off in My profile tell nobody (V129).
-- Sabotages: supabase/tests/sabotage/end-tells-nobody.sql, supabase/tests/sabotage/the-actor-hears-their-own-change.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Admin', 'admin')::text, true);   -- sees every record (V97)
select set_config('t.dep', test.department('notify_one')::text, true);
update core.department set head_person_id = current_setting('t.head')::uuid where id = current_setting('t.dep')::uuid;
insert into core.team (department_id, code, name_en, name_ar, lead_person_id)
values (current_setting('t.dep')::uuid, 'desk', 'Desk', 'مكتب', current_setting('t.head')::uuid);
select set_config('t.team', (select id::text from core.team where department_id = current_setting('t.dep')::uuid), true);
insert into notify.follow (person_id, entity_table, entity_id)
values (current_setting('t.am2')::uuid, 'core.department', current_setting('t.dep')::uuid),
       (current_setting('t.head')::uuid, 'core.department', current_setting('t.dep')::uuid);
select test.eq((select count(*)::int from notify.notification), 0, 'what the system wrote told nobody');

-- the admin renames the department and its team in one request
select set_config('t.r1', test.act(current_setting('t.admin')::uuid, 'department.renamed')::text, true);
update core.department set name_en = 'Notify Renamed' where id = current_setting('t.dep')::uuid;
update core.team set name_en = 'Desk Renamed' where id = current_setting('t.team')::uuid;
select test.done();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.head')::uuid
                and request_id = current_setting('t.r1')::uuid), 1,
  'the owner of both records is told once for the request');
select test.eq((select kind from notify.notification where person_id = current_setting('t.head')::uuid
                and request_id = current_setting('t.r1')::uuid), 'changed_by_other',
  'as the owner, though they follow it too');
select test.eq((select entity_id from notify.notification where person_id = current_setting('t.head')::uuid
                and request_id = current_setting('t.r1')::uuid), current_setting('t.dep')::uuid,
  'linked to the first record the request changed');
select test.eq((select kind from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = current_setting('t.r1')::uuid), 'followed_change', 'a follower is told');
select test.eq((select actor_id from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = current_setting('t.r1')::uuid), current_setting('t.admin')::uuid,
  'naming who made the change (by id — the name is read live)');
select test.eq((select label_key from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = current_setting('t.r1')::uuid), 'department.renamed', 'and what it was');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.admin')::uuid), 0,
  'the one who made the change is never told of it');
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am1')::uuid), 0,
  'nobody else is told');

-- the owner changing their own record: followers hear, the owner does not
select set_config('t.r2', test.act(current_setting('t.head')::uuid)::text, true);
update core.department set name_ar = 'اسم للإشعار' where id = current_setting('t.dep')::uuid;
select test.done();
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r2')::uuid), 1,
  'an owner''s own change tells only the follower');

-- switched off, muted, or off for the company: not told
insert into core.person_profile (person_id, notify) values (current_setting('t.am2')::uuid, '{"followed_change": {"in_app": false}}');
select set_config('t.r3', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'Notify Renamed Again' where id = current_setting('t.dep')::uuid;
select test.done();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and request_id = current_setting('t.r3')::uuid), 0,
  'a kind a person turned off in My profile does not reach them');
update core.person set can_sign_in = false where id = current_setting('t.head')::uuid;
select set_config('t.r4', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'Notify Renamed Thrice' where id = current_setting('t.dep')::uuid;
select test.done();
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r4')::uuid), 0,
  'a person who may not sign in is not told');
update core.person set can_sign_in = true, department_id = current_setting('t.dep')::uuid
where id = current_setting('t.head')::uuid;
insert into core.setting (key, department_id, value, valid_from, reason)
values ('notify.kinds_enabled', current_setting('t.dep')::uuid, '["assigned", "mentioned"]', core.riyadh_today(),
        'made up for a test');
select set_config('t.r5', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'Notify Renamed Four' where id = current_setting('t.dep')::uuid;
select test.done();
select test.eq((select count(*)::int from notify.notification where request_id = current_setting('t.r5')::uuid), 0,
  'a kind switched off for the person''s department reaches nobody there');
