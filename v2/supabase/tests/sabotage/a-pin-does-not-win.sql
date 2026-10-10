-- Sabotage: a-pin-does-not-win
-- Breaks: sql:MPN-01
-- Expect: a pin wins: both rows match by it
-- A pin is kept but the match ignores it: a pinned invoice still belongs to nobody (section 3.5 level 0).
create or replace function finance.partner_match(p_invoice uuid)
returns table (partner_id uuid, state text, level text)
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.partner_id, u.partner_id), case when p.id is not null then 'matched' else u.state end,
         case when p.id is not null then 'pin' else u.level end
  from finance.partner_match_unpinned(p_invoice) u
  left join partner.match_pin p on false
$$;
