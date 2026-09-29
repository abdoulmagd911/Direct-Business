-- Sabotage: an-email-undone-by-a-former-admin
-- Breaks: sql:UNDO-06
-- Expect: an e-mail change is an admin's to undo, even for the one who made it
-- Undo forgets that allowed e-mails and sign-in links are access (P3-6a's list): whoever made such a change undoes it
-- within the window, admin or not.
create or replace function audit.touches_access(p_request uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from audit.change c
    where c.request_id = p_request
      and (c.table_name in ('core.person_page_level', 'core.person_capability', 'core.role_page_level',
                            'core.role_capability')
           or (c.table_name = 'core.person' and c.fields && array['role_id', 'kind', 'active', 'can_sign_in'])))
$$;
