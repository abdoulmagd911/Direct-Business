-- ACC-06 — what write functions and row rules ask (§5, V110): authz.require() refuses with the key access.needs_level
-- and names the page and level needed; authz.require_capability() names the capability; nobody signed in is refused;
-- authz.in_my_departments() is my department, the ones I was let see, or every one for an admin; authz.reports_to()
-- follows the manager chain down from me. Sabotage: supabase/tests/sabotage/require-asks-nothing.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
update core.person set manager_id = current_setting('t.admin')::uuid where id = current_setting('t.head')::uuid;
update core.person set manager_id = current_setting('t.head')::uuid where id = current_setting('t.am1')::uuid;

select test.claims_of(current_setting('t.am1')::uuid);
do $$
declare
  msg text;
  det text;
begin
  begin
    perform authz.require('finance', 'full');
    perform test.fail('a team member at Own on Finance was let through to Full');
  exception when insufficient_privilege then
    get stacked diagnostics msg = message_text, det = pg_exception_detail;
  end;
  perform test.eq(msg, 'access.needs_level', 'refused with the rule''s key');
  perform test.eq(det::jsonb, '{"page": "finance", "level": "full"}'::jsonb, 'naming the page and the level needed');
  begin
    perform authz.require_capability('org.sign_out');
    perform test.fail('a team member was let sign people out');
  exception when insufficient_privilege then
    get stacked diagnostics msg = message_text, det = pg_exception_detail;
  end;
  perform test.eq(msg, 'access.needs_capability', 'a capability refusal has its own key');
  perform test.eq(det::jsonb, '{"capability": "org.sign_out"}'::jsonb, 'naming the capability needed');
end $$;
select test.eq(authz.require('tasks', 'own'), current_setting('t.am1')::uuid, 'allowed: it answers who is calling');
select test.ok(authz.in_my_departments(test.department()), 'my own department');
select test.ok(not authz.in_my_departments(test.department('other')), 'not another one');
insert into core.person_department (person_id, department_id)
values (current_setting('t.am1')::uuid, test.department('other'));
select test.ok(authz.in_my_departments(test.department('other')), '… until I am let see it');
select test.ok(not authz.reports_to(current_setting('t.head')::uuid), 'my manager does not report to me');
select test.ok(not authz.reports_to(current_setting('t.am1')::uuid), 'nor do I');

select test.claims_of(current_setting('t.head')::uuid);
select test.ok(authz.reports_to(current_setting('t.am1')::uuid), 'my direct report');
select test.claims_of(current_setting('t.admin')::uuid);
select test.ok(authz.reports_to(current_setting('t.am1')::uuid), 'and further down the line');
select test.ok(authz.in_my_departments(test.department('third')), 'an admin sees every department');

select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select test.raises($$select authz.require('tasks', 'view')$$, '42501', 'nobody signed in', 'auth.no_active_person');
