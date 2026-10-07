-- Sabotage: the-owner-chain-skips-the-project
-- Breaks: sql:TSK-02
-- Expect: unnamed, the owner is the project's owner
-- The chain forgets the project's owner and goes straight to the account manager.
create or replace function work.default_owner(p_named uuid, p_project uuid, p_partner uuid, p_me uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    p_named,
    (select o.person_id from partner.side_owners(p_partner, 'client') o(person_id) where work.person_ok(o.person_id) limit 1),
    p_me)
$$;
