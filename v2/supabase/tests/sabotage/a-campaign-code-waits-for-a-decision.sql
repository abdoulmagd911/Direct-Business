-- Sabotage: a-campaign-code-waits-for-a-decision
-- Breaks: sql:MATCH-01
-- Expect: each row matches by its first level
-- A campaign code is not recognised, so its rows wait in Needs a decision instead of being credited to nobody (V65).
create or replace function finance.match_detail(p_invoice uuid)
returns table (partner_id uuid, state text, level text, campaign_code_id uuid, candidates uuid[])
language plpgsql stable security definer set search_path = ''
as $$
declare
  v finance.invoice;
  day date;
  lvl text;
  hits uuid[];
  camp uuid;
  levels text[];
begin
  select * into v from finance.invoice i where i.id = p_invoice;
  if v.id is null then
    return;
  end if;
  day := v.created_on;
  -- V420: a client ID nobody holds on the day stops the match
  if v.client_id_key is not null and partner.holders(array['payments_client_id'], v.client_id_key, day) is null then
    return query select null::uuid, 'unknown_client_id'::text, 'client_id'::text, null::uuid, null::uuid[];
    return;
  end if;
  levels := coalesce(array(select pg_catalog.jsonb_array_elements_text(core.setting_at('partner.match_order', null, day))),
                     array['client_id', 'tax_no', 'code', 'email', 'phone', 'alias']);
  foreach lvl in array levels loop
    hits := case lvl
      when 'client_id' then partner.holders(array['payments_client_id'], v.client_id_key, day)
      when 'tax_no' then partner.holders(array['vat', 'cr'], v.tax_key, day)
      when 'code' then partner.holders(array['discount_code'], v.code_key, day)
      when 'email' then partner.holders(array['email'], v.email_key, day)
      when 'phone' then partner.holders(array['phone'], v.phone_key, day)
      -- a typed alias, only on a row with no client ID (V412, V421)
      when 'alias' then case when v.client_id_key is null then
                          (select pg_catalog.array_agg(distinct x order by x)
                           from pg_catalog.unnest(coalesce(partner.holders(array['name'], v.name_key, day, 'alias'), '{}'::uuid[])
                                                  || coalesce(partner.holders(array['name'], v.name2_key, day, 'alias'), '{}'::uuid[])) x)
                        end
    end;
    if hits is not null and pg_catalog.cardinality(hits) > 0 then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end,
                          lvl, null::uuid, case when pg_catalog.cardinality(hits) > 1 then hits end;
      return;
    end if;
    -- a live campaign code (V65): credited to nobody, listed apart
    if false then
      select c.id into camp from partner.campaign_code c
      where c.deleted_at is null and c.code_key = v.code_key
        and pg_catalog.daterange(c.valid_from, c.valid_to, '[]') @> day
        and not partner.is_blocked('discount_code', c.code_key)
      limit 1;
      if camp is not null then
        return query select null::uuid, 'campaign'::text, 'code'::text, camp, null::uuid[];
        return;
      end if;
    end if;
  end loop;
  -- a person, not an organisation (D25)
  if v.client_id_key is null and exists (select 1 from partner.individual_name n
                                         where n.deleted_at is null and n.name_key in (v.name_key, v.name2_key)) then
    return query select null::uuid, 'individual'::text, 'name'::text, null::uuid, null::uuid[];
    return;
  end if;
  return query select null::uuid, 'none'::text, null::text, null::uuid, null::uuid[];
end
$$;
