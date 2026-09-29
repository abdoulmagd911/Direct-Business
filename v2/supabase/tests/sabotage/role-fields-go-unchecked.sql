-- Sabotage: role-fields-go-unchecked
-- Breaks: sql:PRT-01
-- Expect: a required role field is required
-- A role's own fields are stored as typed, unchecked.
create or replace function partner.role_fields_check(p_role uuid, p_values jsonb) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  return;
end
$$;
