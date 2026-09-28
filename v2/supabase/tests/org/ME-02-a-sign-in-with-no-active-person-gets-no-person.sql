-- ME-02 — a sign-in with no person behind it is 'not_listed'; a person switched off, removed or not allowed to sign in
-- is 'switched_off' and gets no person, levels or profile; authz.me() is null for all of them; a caller who is not
-- signed in cannot ask at all (§4: an auth user with no active person behind it can read and write nothing).
-- Sabotage: supabase/tests/sabotage/me-lets-a-switched-off-person-in.sql.
select set_config('t.off', test.person('Test Switched Off', 'member')::text, true);
select set_config('t.nosign', test.person('Test Not Allowed', 'member', 'commercial', false)::text, true);
select set_config('t.gone', test.person('Test Removed', 'member')::text, true);
update core.person set active = false where id = current_setting('t.off')::uuid;
update core.person set deleted_at = now(), delete_reason = 'made up for a test' where id = current_setting('t.gone')::uuid;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000abcd', 'test.stranger@example.test');
do $$
declare
  who uuid;
begin
  perform test.as_auth('00000000-0000-4000-8000-00000000abcd');
  perform test.eq(api.me() ->> 'status', 'not_listed', 'a sign-in linked to no person');
  perform test.ok(authz.me() is null, 'authz.me() is null for it');
  perform test.as_owner();
  foreach who in array array[current_setting('t.off')::uuid, current_setting('t.nosign')::uuid, current_setting('t.gone')::uuid] loop
    perform test.as_person(who);
    perform test.eq(api.me(), '{"status": "switched_off"}'::jsonb, 'switched off, not allowed, or removed');
    perform test.ok(authz.me() is null, 'authz.me() is null for them');
    perform test.as_owner();
  end loop;
  perform test.as_anon();
  perform test.raises('select api.me()', '42501', 'not signed in: no answer at all');
end $$;
