-- PPL-04 — an e-mail already held (V178; the production finding W24): adding a person with an e-mail another person
-- holds — in other capitals, with a space around it — is refused as people.email_taken, naming the holder, and nothing
-- is saved: no person without their e-mail. Adding it to someone later is refused the same way. Made up.
-- Sabotages: supabase/tests/sabotage/a-taken-email-said-without-its-holder.sql,
--            supabase/tests/sabotage/an-email-compared-by-its-capitals.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('commercial')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.person_create(jsonb_build_object('full_name_en', 'Test Holder', 'department_id', current_setting('t.dep'),
  'email', 'test.held@example.test'), 'made up: the first holder');

do $$
declare
  st text;
  msg text;
  holder text;
begin
  perform api.person_create(jsonb_build_object('full_name_en', 'Test Taken Twice',
    'department_id', current_setting('t.dep'), 'email', ' Test.HELD@Example.test '), 'made up: the same mailbox');
  perform set_config('t.refused', 'ran', true);
exception when others then
  get stacked diagnostics st = returned_sqlstate, msg = message_text, holder = pg_exception_detail;
  perform set_config('t.refused', st || ' ' || msg || ' · ' || coalesce(holder, ''), true);
end
$$;
select test.eq(current_setting('t.refused'), '23505 people.email_taken · Test Holder',
  'the same e-mail in other capitals is refused, naming who holds it');
select test.as_owner();
select test.eq((select count(*)::int from core.person where full_name_en = 'Test Taken Twice'), 0,
  'and nothing is saved: no person without their e-mail');

select set_config('t.other', test.person('Test Someone Else', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_email_add(%L, %L)', current_setting('t.other'), 'TEST.held@example.test'),
  '23505', 'nor is it added to someone else later', 'people.email_taken');
