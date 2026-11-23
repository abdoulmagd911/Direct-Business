-- Sabotage: the-credit-limit-ignores-a-persons-own-setting
-- Breaks: sql:XTR-02
-- Expect: a team member set to Allowed is told they can change it
-- The rule that names who may change the credit limit reads the role alone again (Landing 31), so a person's own
-- setting on Change credit limits — Allowed or View only — changes nothing.
create or replace function finance.credit_limit_can_change(p_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.person p join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
      and (r.is_admin or r.key in ('head', 'manager')))
$$;
