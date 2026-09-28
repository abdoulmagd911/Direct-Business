-- Sabotage: switched-off-people-get-codes
-- Breaks: sql:SIGN-02
-- Expect: a switched-off person
-- The pre-check asks only whether the e-mail is listed, not whether its person may sign in.
create or replace function core.sign_in_state(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  select case when exists (select 1 from core.person_email e
                           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null)
              then 'allowed' else 'not_listed' end
$$;
