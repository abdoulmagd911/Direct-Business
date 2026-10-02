-- SIGN-12 — nobody removes their own last allowed e-mail (QA-208, the database half; V219). An admin removing their
-- only allowed e-mail is refused, whatever the screen offers; with a second one, the first may go; the one left is
-- refused again; an Undo of its adding — through the admin route, with its ticket — is refused too. Another person's
-- last e-mail may still be removed: that is how a sign-in is taken away. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-admin-removes-their-own-last-email.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.u1', test.sign_in(current_setting('t.admin')::uuid)::text, true);
select test.sign_in(current_setting('t.am1')::uuid);
select set_config('t.e1', (select id from core.person_email where person_id = current_setting('t.admin')::uuid)::text,
  true);
select set_config('t.eam', (select id from core.person_email where person_id = current_setting('t.am1')::uuid)::text,
  true);

select test.as_auth(current_setting('t.u1')::uuid, test.start_session(current_setting('t.u1')::uuid));
select test.raises(format('select api.person_email_remove(%L, %L)', current_setting('t.e1'), 'Made-up: tidying up'),
  'P0001', 'an admin cannot remove their own last allowed e-mail', 'people.own_last_email');

-- a second e-mail, linked to a sign-in of its own
select set_config('t.r2', api.person_email_add(current_setting('t.admin')::uuid, 'made.up.second@example.test', false,
  'Made-up: a second mailbox')::text, true);
select set_config('t.e2', current_setting('t.r2')::jsonb ->> 'id', true);
select test.as_owner();
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000002b2', 'made.up.second@example.test');
select test.as_auth(current_setting('t.u1')::uuid, test.start_session(current_setting('t.u1')::uuid));
select api.person_auth_link('made.up.second@example.test', '00000000-0000-4000-8000-0000000002b2');

-- signed in with the second: the first may go; the second, now the last, may not — nor may an Undo of its adding
select test.as_auth('00000000-0000-4000-8000-0000000002b2',
  test.start_session('00000000-0000-4000-8000-0000000002b2'));
select test.runs(format('select api.person_email_remove(%L, %L)', current_setting('t.e1'), 'Made-up: the old one'),
  'with a second one, the first may go');
select test.raises(format('select api.person_email_remove(%L, %L)', current_setting('t.e2'), 'Made-up: and this one'),
  'P0001', 'the one left is refused again', 'people.own_last_email');
select test.as_owner();
select set_config('t.k', core.auth_ticket_issue('undo', current_setting('t.r2')::jsonb ->> 'request_id',
  current_setting('t.admin')::uuid)::text, true);
select test.as_auth('00000000-0000-4000-8000-0000000002b2',
  test.start_session('00000000-0000-4000-8000-0000000002b2'));
select test.raises(format('select api.undo_ticketed(%L, %L)', current_setting('t.r2')::jsonb ->> 'request_id',
  current_setting('t.k')), 'P0001', 'an Undo that would take away the last one is refused too', 'people.own_last_email');

-- another person's last e-mail may still be removed: that is how their sign-in is taken away
select test.runs(format('select api.person_email_remove(%L, %L)', current_setting('t.eam'), 'Made-up: has left'),
  'another person''s last e-mail may be removed');
select test.as_owner();
select test.eq((select array_agg(email::text) from core.person_email where person_id = current_setting('t.admin')::uuid
                and deleted_at is null), array['made.up.second@example.test'], 'the admin keeps the second');
select test.eq((select count(*)::int from core.person_email where person_id = current_setting('t.am1')::uuid
                and deleted_at is null), 0, 'the team member has none');
