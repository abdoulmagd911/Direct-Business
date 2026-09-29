-- PPL-03 — Settings → People → Add (ACC-093): a person, their allowed e-mail, role and sign-in switch are one request —
-- one entry in the log, one Undo that takes the person and the e-mail back together. Made up.
-- Sabotage: supabase/tests/sabotage/a-person-and-their-email-apart.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('commercial')::text, true);
select set_config('t.role', (select id::text from core.role where key = 'member'), true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.new', api.person_create(jsonb_build_object('full_name_en', 'Test Added With Email',
  'department_id', current_setting('t.dep'), 'role_id', current_setting('t.role'), 'can_sign_in', true,
  'email', 'test.added.with.email@example.test'), 'made up: a new person')::text, true);
select test.ok((current_setting('t.new')::jsonb ->> 'email_id') is not null, 'the e-mail is allowed at once');
select test.as_owner();
select test.eq((select string_agg(distinct c.table_name, ',' order by c.table_name) from audit.change c
                where c.request_id = (current_setting('t.new')::jsonb ->> 'request_id')::uuid
                  and c.table_name in ('core.person', 'core.person_email')),
  'core.person,core.person_email', 'the person and the e-mail are one request');
select test.eq((select count(*)::int from audit.request r where r.actor_id = current_setting('t.admin')::uuid
                and r.label_key = 'person_email.added'), 0, 'with no request of its own for the e-mail');
-- the admin route's ticket, for this admin and this request (V162)
select set_config('t.k', core.auth_ticket_issue('undo', current_setting('t.new')::jsonb ->> 'request_id',
  current_setting('t.admin')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(api.undo_ticketed((current_setting('t.new')::jsonb ->> 'request_id')::uuid,
  current_setting('t.k')::uuid) -> 'auth_resync',
  jsonb_build_array(current_setting('t.new')::jsonb ->> 'id'), 'the undo names the person for the sign-in re-sync');
select test.as_owner();
select test.eq((select count(*)::int from core.person_email where email = 'test.added.with.email@example.test'
                and deleted_at is null), 0, 'one Undo takes the e-mail back');
select test.eq((select count(*)::int from core.person where id = (current_setting('t.new')::jsonb ->> 'id')::uuid
                and deleted_at is null), 0, 'with the person');
