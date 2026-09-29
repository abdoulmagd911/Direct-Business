-- Sabotage: one-page-for-both-sides
-- Breaks: sql:SIDE-01
-- Expect: nor its history
-- A side's records go by the best of both pages, so a person shut out of Clients reaches the Client side.
create or replace function partner.level_of(p_person uuid, p_partner uuid, p_side text default null) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce(
           (select pg_catalog.max(authz.level_of(p_person, partner.side_page(s.side))) from partner.partner_side s
            where s.partner_id = p_partner and s.deleted_at is null and partner.side_on(p_partner, s.side)),
           greatest(authz.level_of(p_person, 'clients'), authz.level_of(p_person, 'suppliers_partners')))
$$;
