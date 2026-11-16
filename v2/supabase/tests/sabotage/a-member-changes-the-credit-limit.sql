-- Sabotage: a-member-changes-the-credit-limit
-- Breaks: sql:CCL-01
-- Expect: a team member reads the credit limit — the default — and is told they cannot change it
-- The rule that names who may change the credit limit of Settings → Finance lets everyone who works here through, so
-- a team member and a viewer change it too (Landing 31: a manager, a head of department and an admin only).
create or replace function finance.credit_limit_can_change(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from core.person p
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null)
$$;
