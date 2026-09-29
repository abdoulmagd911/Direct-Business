-- UNDO-06 — undoing a sign-in change (V128, V138; QA): adding or removing an allowed e-mail, linking a sign-in, or
-- switching a person off or on is access, so only an admin undoes it — not the person it belongs to, and not the one
-- who made it once they are no longer an admin. Undo names the people whose sign-ins it changed (auth_resync), so the
-- admin route re-syncs their Auth ban at once — and only the admin route, which takes a one-time ticket first, can undo
-- or restore one (V162), so no screen skips the re-sync. The ticket is for one person and one target, under a minute
-- old, used once, and named in the call: a ticket for another request, an old one, one left for someone else, and a
-- plain call are all refused (QA-94, QA-95). A sign-in link is never deleted, not even with its auth user. Made up.
-- Sabotages: supabase/tests/sabotage/an-email-undone-by-a-former-admin.sql,
--            supabase/tests/sabotage/a-sign-in-link-is-deleted.sql,
--            supabase/tests/sabotage/a-sign-in-undone-without-its-ticket.sql,
--            supabase/tests/sabotage/a-sign-in-restored-without-its-ticket.sql,
--            supabase/tests/sabotage/a-ticket-for-any-target.sql,
--            supabase/tests/sabotage/a-ticket-that-never-ages.sql,
--            supabase/tests/sabotage/a-ticket-for-anyone.sql,
--            supabase/tests/sabotage/a-switch-is-no-sign-in-change.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.admin2', test.person('Test Second Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);

select test.as_person(current_setting('t.admin2')::uuid);
select set_config('t.r1', api.person_email_add(current_setting('t.am1')::uuid, 'made.up.undo@example.test', false,
  'made up: a second mailbox') ->> 'request_id', true);
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), '42501',
  'the person an e-mail belongs to cannot undo its adding', 'undo.not_allowed');
-- whatever a page grants: were the allow-list ever registered on an ordinary page, Full there would undo none of it
select test.as_owner();
update core.person set role_id = (select id from core.role where key = 'head')
where id = current_setting('t.admin2')::uuid;
update core.entity set page_key = 'clients' where table_name = 'core.person_email';
select test.as_person(current_setting('t.admin2')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), '42501',
  'an e-mail change is an admin''s to undo, even for the one who made it', 'undo.not_allowed');
select test.as_owner();
update core.entity set page_key = 'settings.org' where table_name = 'core.person_email';
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), 'P0001',
  'even an admin undoes it only through the admin route, which re-syncs Auth', 'undo.via_admin_route');
select test.as_owner();
-- a ticket serves only its own request, its own person, and only for a minute
select set_config('t.k0', core.auth_ticket_issue('undo', gen_random_uuid()::text, current_setting('t.admin')::uuid)::text,
  true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo_ticketed(%L, %L)', current_setting('t.r1'), current_setting('t.k0')), 'P0001',
  'a ticket for another request opens nothing', 'undo.via_admin_route');
select test.as_owner();
select set_config('t.k1', core.auth_ticket_issue('undo', current_setting('t.r1'), current_setting('t.admin2')::uuid)::text,
  true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo_ticketed(%L, %L)', current_setting('t.r1'), current_setting('t.k1')), 'P0001',
  'nor one issued for someone else', 'undo.via_admin_route');
select test.raises(format('select api.undo(%L)', current_setting('t.r1')), 'P0001',
  'nor a plain undo, whatever tickets are lying about', 'undo.via_admin_route');
select test.as_owner();
insert into core.auth_ticket (kind, target, person_id, issued_at)
values ('undo', current_setting('t.r1'), current_setting('t.admin')::uuid, now() - interval '2 minutes')
returning set_config('t.k1', id::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.undo_ticketed(%L, %L)', current_setting('t.r1'), current_setting('t.k1')), 'P0001',
  'nor one older than a minute', 'undo.via_admin_route');
select test.as_owner();
select set_config('t.k1', core.auth_ticket_issue('undo', current_setting('t.r1'), current_setting('t.admin')::uuid)::text,
  true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.u1', api.undo_ticketed(current_setting('t.r1')::uuid, current_setting('t.k1')::uuid)::text, true);
select test.eq(current_setting('t.u1')::jsonb -> 'auth_resync', jsonb_build_array(current_setting('t.am1')),
  'an admin undoes it, and the answer names whose sign-in to re-sync');
select test.as_owner();
select test.eq((select count(*)::int from core.person_email where email = 'made.up.undo@example.test'
                and deleted_at is null), 0, 'the e-mail is no longer allowed');

-- a removal, undone: the e-mail is allowed again, and the person named for the re-sync
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.e2', api.person_email_add(current_setting('t.am1')::uuid, 'made.up.second@example.test', false,
  'made up') ->> 'id', true);
select set_config('t.r3', api.person_email_remove(current_setting('t.e2')::uuid, 'made up: removed by mistake')
  ->> 'request_id', true);
select test.as_owner();
select set_config('t.k3', core.auth_ticket_issue('undo', current_setting('t.r3'), current_setting('t.admin')::uuid)::text,
  true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.u3', api.undo_ticketed(current_setting('t.r3')::uuid, current_setting('t.k3')::uuid)::text, true);
select test.eq(current_setting('t.u3')::jsonb -> 'auth_resync', jsonb_build_array(current_setting('t.am1')),
  'undoing a removal names the person too');
select test.as_owner();
select test.eq((select count(*)::int from core.person_email where email = 'made.up.second@example.test'
                and deleted_at is null), 1, 'whose e-mail is allowed again');

-- a switch-off, undone: the person is back on, and named for the re-sync
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.r2', api.person_switch(current_setting('t.am1')::uuid, false, 'made up: left') ->> 'request_id',
  true);
select test.raises(format('select api.undo(%L)', current_setting('t.r2')), 'P0001',
  'a switch-off is a sign-in change: undone only through the admin route', 'undo.via_admin_route');
select test.as_owner();
select set_config('t.k2', core.auth_ticket_issue('undo', current_setting('t.r2'), current_setting('t.admin')::uuid)::text,
  true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.u2', api.undo_ticketed(current_setting('t.r2')::uuid, current_setting('t.k2')::uuid)::text, true);
select test.eq(current_setting('t.u2')::jsonb -> 'auth_resync', jsonb_build_array(current_setting('t.am1')),
  'undoing a switch-off names the person too');
select test.as_owner();
select test.eq((select active and can_sign_in from core.person where id = current_setting('t.am1')::uuid), true,
  'who is switched on again');

-- a sign-in link is never deleted
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select test.raises(format('delete from core.person_auth where auth_user_id = %L', current_setting('t.uid')), 'P0001',
  'a sign-in link is never deleted', 'person_auth.never_deleted');
select test.raises(format('delete from auth.users where id = %L', current_setting('t.uid')), 'P0001',
  'not even by deleting its auth user', 'person_auth.never_deleted');

-- a removed e-mail restored from Recently deleted: only through the admin route, which re-syncs Auth
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.e4', api.person_email_add(current_setting('t.am1')::uuid, 'made.up.restore@example.test', false,
  'made up') ->> 'id', true);
select api.person_email_remove(current_setting('t.e4')::uuid, 'made up: removed');
select test.raises(format('select api.restore(%L, %L)', 'person_email', current_setting('t.e4')), 'P0001',
  'a sign-in record is restored only through the admin route', 'restore.via_admin_route');
select test.as_owner();
select set_config('t.k4', core.auth_ticket_issue('restore', 'person_email:' || current_setting('t.e4'),
  current_setting('t.admin')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.restore_ticketed('person_email', current_setting('t.e4')::uuid, current_setting('t.k4')::uuid,
  'made up: back') -> 'auth_resync',
  jsonb_build_array(current_setting('t.am1')), 'with its ticket it is restored, naming whose sign-in to re-sync');
select api.person_email_remove(current_setting('t.e4')::uuid, 'made up: removed again');
select test.raises(format('select api.restore_ticketed(%L, %L, %L)', 'person_email', current_setting('t.e4'),
  current_setting('t.k4')), 'P0001', 'a ticket serves once', 'restore.via_admin_route');
