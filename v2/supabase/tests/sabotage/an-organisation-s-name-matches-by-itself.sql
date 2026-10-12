-- Sabotage: an-organisation-s-name-matches-by-itself
-- Breaks: sql:NAD-01
-- Expect: rows wait grouped by customer, with the count and the riyals at stake; an organisation's own name does not match
-- An organisation's official or trade name matches invoices by itself, not only an alias a person typed (V421).
create or replace function finance.partner_match_unpinned(p_invoice uuid)
returns table (partner_id uuid, state text, level text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v finance.invoice;
  hits uuid[];
begin
  select * into v from finance.invoice i where i.id = p_invoice;
  if v.id is null then
    return;
  end if;
  if v.client_id_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = v.client_id_key;
    if hits is null then
      return query select null::uuid, 'unknown_client_id'::text, 'client_id'::text;
      return;
    end if;
    return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                        case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'client_id'::text;
    return;
  end if;
  if v.tax_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind in ('vat', 'cr') and d.value_key = v.tax_key;
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'tax_no'::text;
      return;
    end if;
  end if;
  if v.code_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'discount_code' and d.value_key = v.code_key
      and v.created_on between coalesce(d.valid_from, '-infinity'::date) and coalesce(d.valid_to, 'infinity'::date);
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'code'::text;
      return;
    end if;
  end if;
  if v.email_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'email' and d.value_key = v.email_key;
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'email'::text;
      return;
    end if;
  end if;
  -- a name a person typed as an organisation's alias, only on a row with no client ID (V412, V421)
  if v.client_id_key is null and coalesce(v.name_key, v.name2_key) is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'name' and d.value_key in (v.name_key, v.name2_key);
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'alias'::text;
      return;
    end if;
    -- a person, not an organisation (D25)
    if exists (select 1 from partner.individual_name n where n.deleted_at is null and n.name_key in (v.name_key, v.name2_key)) then
      return query select null::uuid, 'individual'::text, 'name'::text;
      return;
    end if;
  end if;
  return query select null::uuid, 'none'::text, null::text;
end
$$;
