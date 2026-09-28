-- Sabotage: a-removed-email-still-signs-in
-- Breaks: sql:SIGN-06
-- Expect: and can read or write nothing
-- authz.me() no longer asks whether the sign-in's e-mail is still allowed.
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and (core.live_device()).id is not null
$$;
