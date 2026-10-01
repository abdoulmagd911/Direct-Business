-- Sabotage: a-wrong-password-is-a-failure-to-send
-- Breaks: sql:LOCK-01
-- Expect: the fifth within fifteen minutes locks the e-mail
-- A wrong password is logged as the service failing: nothing counts it.
create or replace function core.sign_in_password_refused(p_email text, p_detail text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  wrong boolean := coalesce(p_detail in ('invalid_credentials', 'invalid_grant', 'Invalid login credentials'), false);
begin
  insert into core.sign_in_log (person_id, email, provider, result, detail, user_agent, method)
  values ((select e.person_id from core.person_email e
           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
          lower(p_email), 'email', 'provider_error',
          pg_catalog.left(p_detail, 200), p_user_agent, 'password');
  if not wrong then
    return 'provider_error';
  end if;
  return case when core.sign_in_limited(p_email) = 'locked' then 'locked' else 'wrong_password' end;
end
$$;
