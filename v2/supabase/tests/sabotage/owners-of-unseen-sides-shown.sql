-- Sabotage: owners-of-unseen-sides-shown
-- Breaks: sql:SIDE-02
-- Expect: the card names no owner of a side they cannot see
-- The card and the hover card name the owner of a side the reader cannot see.
create or replace function partner.owner_seen_by(p_partner uuid, p_person uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select o from partner.partner_side s cross join lateral partner.side_owners(p_partner, s.side) o
  where s.partner_id = p_partner and s.deleted_at is null
  order by s.side limit 1
$$;
