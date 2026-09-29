-- AUD-04 — one person action is one request: every write between audit.begin and audit.end shares it, a nested begin
-- joins it, and after audit.end the next write is not attributed to it (§3.3).
-- Sabotage: supabase/tests/sabotage/end-leaves-the-request-open.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.claims_of(current_setting('t.head')::uuid);   -- as inside an api function called by them
select set_config('t.req', audit.begin('ui', 'org.saved')::text, true);
select test.eq(audit.begin('ui', 'nested.call'), current_setting('t.req')::uuid, 'a nested begin joins the open request');
insert into core.department (code, name_en, name_ar) values ('test_a', 'Test A', 'قسم أ');
insert into core.team (department_id, code, name_en, name_ar) select id, 'team_a', 'Team A', 'فريق أ' from core.department where code = 'test_a';
select audit.end();   -- closes the nested begin
insert into core.team (department_id, code, name_en, name_ar) select id, 'team_b', 'Team B', 'فريق ب' from core.department where code = 'test_a';
select test.eq(audit.end(), current_setting('t.req')::uuid, 'the outer end closes the request');
insert into core.team (department_id, code, name_en, name_ar) select id, 'team_c', 'Team C', 'فريق ج' from core.department where code = 'test_a';
do $$
declare
  req uuid := current_setting('t.req')::uuid;
  r audit.request := (select r from audit.request r where r.id = req);
begin
  perform test.eq(r.actor_id, current_setting('t.head')::uuid, 'the request is the head''s');
  perform test.eq((select count(*) from audit.change where request_id = req)::int, 3,
    'the department and two teams are one request');
  perform test.ok((select request_id from audit.change where table_name = 'core.team'
                   and row_id = (select id from core.team where code = 'team_c')) <> req,
    'a write after audit.end is not part of it');
end $$;
