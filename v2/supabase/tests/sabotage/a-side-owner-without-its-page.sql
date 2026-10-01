-- Sabotage: a-side-owner-without-its-page
-- Breaks: sql:SIDE-02
-- Expect: the contract's alert reaches its follower who sees it, not its owner who cannot
-- Named a side's owner, a person owns it without its page: its alerts reach them (V147).
create or replace function partner.side_owners(p_partner uuid, p_side text) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.person_id from partner.side_owner m
  where m.partner_id = p_partner and m.deleted_at is null and (p_side is null or m.side = p_side)
    and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())

$$;
