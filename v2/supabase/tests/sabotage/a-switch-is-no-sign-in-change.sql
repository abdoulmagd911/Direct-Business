-- Sabotage: a-switch-is-no-sign-in-change
-- Breaks: sql:UNDO-06
-- Expect: a switch-off is a sign-in change: undone only through the admin route
-- Switching a person off or on is not seen as a sign-in change: its undo skips the admin route and Auth stays as it was.
create or replace function audit.touches_sign_in(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from audit.change c
    where c.request_id = p_request
      and (c.table_name in ('core.person_email', 'core.person_auth')
           or (c.table_name = 'core.person' and false)))
$$;
