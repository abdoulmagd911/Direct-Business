-- Sabotage: an-organisation-s-name-matches-by-itself
-- Breaks: sql:NAD-01
-- Expect: rows wait grouped by customer, with the count and the riyals at stake; an organisation's own name does not match
-- An organisation's official or trade name matches invoices by itself, not only an alias a person typed (V421).
create or replace function partner.holders(p_kinds text[], p_key text, p_day date, p_subkind text default null) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.array_agg(distinct d.partner_id order by d.partner_id)
  from partner.identifier d
  join partner.partner p on p.id = d.partner_id and p.merged_into_id is null
  where p_key is not null and d.kind = any (p_kinds) and d.value_key = p_key
    and partner.money_match(d, p_day) in ('match', 'suggest')
    and not partner.is_blocked(d.kind, d.value_key)
$$;
