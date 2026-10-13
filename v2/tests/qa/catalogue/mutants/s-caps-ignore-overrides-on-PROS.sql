-- Sabotage: capabilities-ignore-overrides
-- Breaks: sql:ACC-02
-- Expect: an override grants what the role does not
-- A capability comes from the role alone; a person's override is never read.
create or replace function authz.can_of(p_person uuid, p_capability text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case when r.is_admin then true
                else coalesce((select x.granted from core.role_capability x
                                where x.role_id = p.role_id and x.capability_key = c.key and x.deleted_at is null),
                              false) end
    from core.person p
    join core.capability c on c.key = p_capability and c.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), false)
$$;
