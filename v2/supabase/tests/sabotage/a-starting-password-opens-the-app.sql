-- Sabotage: a-starting-password-opens-the-app
-- Breaks: sql:SIGN-10
-- Expect: and nobody is behind it yet
-- authz.me() forgets the "must change password" flag: a password an admin set opens every door before it is changed.
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and exists (select 1 from core.person_email e
                where e.person_id = p.id and e.email operator(extensions.=) a.email and e.deleted_at is null)
    and (core.live_device()).id is not null
$$;
