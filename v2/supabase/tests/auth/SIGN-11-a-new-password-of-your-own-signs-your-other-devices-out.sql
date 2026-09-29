-- SIGN-11 — a person's own new password (ACC-021; V166): the server records it — the browser cannot — and in the same
-- request, logged as the person's own, signs every other device of theirs out; the device that changed it stays in.
-- Made up.
-- Sabotage: supabase/tests/sabotage/a-new-password-keeps-the-other-devices.sql.
select set_config('t.p', test.person('Test Own Password', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.p')::uuid)::text, true);
select set_config('t.here', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.phone', test.start_session(current_setting('t.uid')::uuid)::text, true);
select set_config('t.laptop', test.start_session(current_setting('t.uid')::uuid)::text, true);

select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.here')::uuid);
select test.raises(format('select api.own_password_set(%L, %L)', current_setting('t.uid'), current_setting('t.here')),
  '42501', 'the browser cannot record it itself');
select test.as_owner();
set local role service_role;
select set_config('t.done', api.own_password_set(current_setting('t.uid')::uuid, current_setting('t.here')::uuid)::text,
  true);
reset role;
select test.eq((current_setting('t.done')::jsonb ->> 'signed_out')::int, 2, 'the two other devices are signed out');
select test.eq((select string_agg(case when signed_out_at is null then 'in' else sign_out_reason end, ','
                                  order by auth_session_id = current_setting('t.here')::uuid desc)
                from core.device_session where person_id = current_setting('t.p')::uuid),
  'in,person,person', 'this device stays in; the others are out, as the person''s own sign-out');
select test.eq((select count(*)::int from auth.sessions where user_id = current_setting('t.uid')::uuid), 1,
  'and their Supabase sessions are gone');
select test.eq((select r.actor_id::text || ' · ' || r.label_key from audit.request r
                where r.id = (current_setting('t.done')::jsonb ->> 'request_id')::uuid),
  current_setting('t.p') || ' · person_auth.password_changed', 'logged as the person''s own');
select test.ok((select password_set_at is not null and not must_change_password and password_set_by = person_id
                from core.person_auth where auth_user_id = current_setting('t.uid')::uuid), 'and recorded as theirs');
