-- Sabotage: a-leaver-still-signs-in
-- Breaks: sql:LEAVE-03
-- Expect: the sign-in page answers switched off
-- A person whose leaving day has come still gets a code or a password check (V463, ACC-008).
create or replace function core.sign_in_state(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case when p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                then 'allowed' else 'switched_off' end
    from core.person_email e join core.person p on p.id = e.person_id
    where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null), 'not_listed')
$$;
