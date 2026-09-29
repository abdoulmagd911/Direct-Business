-- Sabotage: side-fields-go-unchecked
-- Breaks: sql:PRT-01
-- Expect: a required side field is required
-- A side's own fields are stored as typed, unchecked.
create or replace function partner.side_fields_check(p_side text, p_values jsonb) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
end
$$;
