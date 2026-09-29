-- ACC-08 — the idle window is a setting (V74, §3.2 auth.device_idle_days): a device unused for 8 days is signed in
-- under the default 30, and asked for a new code once the setting says 7 from a date on or before today.
-- Sabotage: supabase/tests/sabotage/the-idle-window-ignores-its-setting.sql.
select set_config('v2.test_now', '2027-01-15 09:00:00+03', true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.uid', test.sign_in(current_setting('t.am1')::uuid)::text, true);
select set_config('t.sid', test.start_session(current_setting('t.uid')::uuid, core.clock() - interval '10 days',
  core.clock() - interval '8 days')::text, true);

select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'status', 'ok', 'unused for 8 days, within the default 30: still signed in');
select test.as_owner();
insert into core.setting (key, department_id, value, valid_from, reason)
values ('auth.device_idle_days', null, '7', '2027-01-01', 'made up for a test');
select test.as_auth(current_setting('t.uid')::uuid, current_setting('t.sid')::uuid);
select test.eq(api.me() ->> 'reason', 'inactive', 'the window is now 7 days: this device asks for a new code');
select test.ok(authz.me() is null, 'and nothing answers it');
