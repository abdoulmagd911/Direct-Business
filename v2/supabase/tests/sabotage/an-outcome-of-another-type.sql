-- Sabotage: an-outcome-of-another-type
-- Breaks: sql:ACT-01
-- Expect: an outcome of another type is refused
-- An outcome is looked up on every list, whatever the activity's type: "demo held" is taken for a call.
create or replace function partner.outcome_of(p_type partner.activity_type, p_outcome text) returns partner.activity_outcome
language plpgsql stable security definer set search_path = ''
as $$
declare
  o partner.activity_outcome;
begin
  if p_outcome is null then
    if exists (select 1 from partner.activity_outcome x where x.activity_type_id = p_type.id and x.active
               and x.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'partner.outcome_required', detail = p_type.key;
    end if;
    return null;
  end if;
  select * into o from partner.activity_outcome x
  where x.active and x.deleted_at is null and (x.key = p_outcome or x.id::text = p_outcome);
  if o.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_outcome', detail = p_outcome;
  end if;
  return o;
end
$$;
