-- QA-208 — An admin never removes their own last allowed email (V431, V144; ACC-004 "nobody changes their own access").
-- Since #127 the person record offers Remove beside every email, one's own record and one's only email included, and
-- api.person_email_remove asks only for an admin: on v2/main at 0973fb9 an admin who removes their own only email is
-- signed out of everything at once (the next call is refused, auth.no_active_person) and nobody but another admin can
-- let them back in. At go-live the owner's admin account is the only admin. Removing one's own second email still
-- works (UNDO-06 does it). Written by the QA auditor to fail until the rule is built. Made-up people only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.second', api.person_email_add(current_setting('t.admin')::uuid, 'made.up.qa208.second@example.test',
  false, 'made up: a second mailbox') ->> 'id', true);
select test.runs(format('select api.person_email_remove(%L, %L)', current_setting('t.second'), 'made up: not needed'),
  'an admin removes their own second email');

select test.as_owner();
select set_config('t.last', (select id::text from core.person_email
  where person_id = current_setting('t.admin')::uuid and deleted_at is null), true);
select test.eq((select count(*)::int from core.person_email
  where person_id = current_setting('t.admin')::uuid and deleted_at is null), 1, 'one allowed email is left');

select test.as_person(current_setting('t.admin')::uuid);
do $$
begin
  perform api.person_email_remove(current_setting('t.last')::uuid, 'made up: my last one');
exception when others then
  null; -- refused, whatever the words: the check below is what matters
end
$$;
select test.as_owner();
select test.eq((select count(*)::int from core.person_email
  where person_id = current_setting('t.admin')::uuid and deleted_at is null), 1,
  'the admin''s own last allowed email is still there: removing it is refused');
