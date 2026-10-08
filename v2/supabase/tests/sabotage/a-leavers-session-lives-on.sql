-- Sabotage: a-leavers-session-lives-on
-- Breaks: sql:LEAVE-03
-- Expect: no door takes their requests
-- A session of a person whose leaving day has come keeps working (V463, ACC-008).
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and not a.must_change_password
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and exists (select 1 from core.person_email e
                where e.person_id = p.id and e.email operator(extensions.=) a.email and e.deleted_at is null)
    and (core.live_device()).id is not null
$$;
