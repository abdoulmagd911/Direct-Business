-- AUD-03 — a write that arrives with no open request (a migration, psql, a function that forgot audit.begin) is
-- logged under an automatic 'system' request by the System person — never by whoever happens to be signed in (V44).
-- Sabotage: supabase/tests/sabotage/unattended-writes-blame-the-login.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
-- the request claims say AM1 is signed in, but nothing opened a request (clear the one the fixtures' own writes
-- opened, as a new transaction would)
select test.claims_of(current_setting('t.am1')::uuid);
select set_config('app.request_id', '', true);
insert into core.department (code, name_en, name_ar) values ('test_unattended', 'Test Unattended', 'قسم للتجربة');
do $$
declare
  c audit.change := test.last_change('core.department', (select id from core.department where code = 'test_unattended'));
  r audit.request := (select r from audit.request r where r.id = c.request_id);
  d core.department := (select d from core.department d where code = 'test_unattended');
begin
  perform test.ok(authz.me() = current_setting('t.am1')::uuid, 'the claims do name AM1 (so the test means something)');
  perform test.ok((select count(*) from audit.change where request_id = c.request_id) = 1,
    'the write opened its own request (it did not join the fixtures'')');
  perform test.eq(r.kind, 'system', 'an automatic system request');
  perform test.eq(r.actor_id, core.system_person_id(), 'attributed to the System person');
  perform test.eq(d.created_by, core.system_person_id(), 'created_by is System, not AM1');
end $$;
