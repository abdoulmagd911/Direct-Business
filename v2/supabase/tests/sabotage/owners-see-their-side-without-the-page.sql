-- Sabotage: owners-see-their-side-without-the-page
-- Breaks: sql:SIDE-02
-- Expect: named the Client side's owner, they still read none of its contracts
-- The world before V167: being named a side's owner opens its records, whatever the side's page says.
create or replace function partner.side_owners(p_partner uuid, p_side text) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.person_id from partner.side_owner m
  where m.partner_id = p_partner and m.deleted_at is null and (p_side is null or m.side = p_side)
    and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())
$$;
create or replace function partner.sees_side(p_person uuid, p_partner uuid, p_side text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_side is null and partner.level_of(p_person, p_partner, null) >= 'view'
      or p_side is not null and (partner.level_of(p_person, p_partner, p_side) >= 'view'
                                 or p_person in (select partner.side_owners(p_partner, p_side)))
$$;
