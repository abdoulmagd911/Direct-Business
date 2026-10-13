-- LINK-02 — search finds tasks and invoices, each within the reader's own access (sweep 12 Oct, D4). A task is found
-- by its title and its number the moment it is saved; a member of another department finds nothing of it; an invoice
-- is found by its number for a reader with View on Finance and by nobody else. Every value is made up.
-- Sabotage: supabase/tests/sabotage/search-finds-tasks-beyond-access.sql.
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_find', 'Test Find Desk', 'فريق البحث'),
       (test.department('test_other_dept'), 'test_far2', 'Test Far Desk', 'فريق بعيد');
select set_config('t.am', test.person('Test Find Member', 'member')::text, true);
select set_config('t.far', test.person('Test Far Member', 'member', 'test_other_dept')::text, true);
select set_config('t.head', test.person('Test Find Finance Head', 'head')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_find') where id = current_setting('t.am')::uuid;
update core.person set team_id = (select id from core.team where code = 'test_far2') where id = current_setting('t.far')::uuid;
-- this member's Finance page is none (members hold Own by default)
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.am')::uuid, 'finance', 'none', 'made up: no Finance');

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up quarterly renewal pack'))::text, true);
select test.eq((select count(*)::int from jsonb_array_elements(api.search('renewal pack') -> 'tasks') x
                where x ->> 'id' = current_setting('t.made')::jsonb ->> 'id'), 1, 'found by its title the moment it is saved');
select test.eq((select count(*)::int from jsonb_array_elements(api.search(current_setting('t.made')::jsonb ->> 'number') -> 'tasks') x
                where x ->> 'id' = current_setting('t.made')::jsonb ->> 'id'), 1, 'and by its number');
select test.eq(api.search('renewal pack') -> 'invoices', '[]'::jsonb, 'a member without Finance finds no invoice');

select test.as_person(current_setting('t.far')::uuid);
select test.eq(api.search('renewal pack') -> 'tasks', '[]'::jsonb, 'another department''s member finds nothing of it');

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-FIND-71', 'status', 'Fully Paid', 'created_on', '2026-10-05', 'total_sar', 70)),
  now() - interval '1 day');
select test.eq((select count(*)::int from jsonb_array_elements(api.search('TX-FIND-71') -> 'invoices') x
                where x ->> 'ref' = 'TX-FIND-71'), 1, 'a reader with View on Finance finds the invoice by its number');
select test.as_person(current_setting('t.am')::uuid);
select test.eq(api.search('TX-FIND-71') -> 'invoices', '[]'::jsonb, 'and the member does not');
