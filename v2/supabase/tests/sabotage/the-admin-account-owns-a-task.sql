-- Sabotage: the-admin-account-owns-a-task
-- Breaks: sql:TSK-01
-- Expect: the admin account owns nothing
-- Only the test account is kept off work; the owner's admin account is named like anyone (QA-214).
create or replace function work.person_ok(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select core.person_available(p_person)
         and exists (select 1 from core.person p where p.id = p_person and p.account <> 'test_account')
$$;
