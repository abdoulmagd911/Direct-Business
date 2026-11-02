-- The money match as §3.5 sets it out (P4-3; V65, V411, V412, V420, V421). One function answers for an invoice:
-- finance.match_detail(invoice) → (partner_id, state, level, campaign_code_id, candidates).
--  * A Payments client ID nobody holds — or held only by an ID closed before the row's day (V411) — stops the match:
--    unknown_client_id, never falling through to VAT, code, email, phone or name (V420).
--  * Otherwise the levels are tried in the order of the setting partner.match_order (default client ID → VAT/CR →
--    discount code within its dates → email → phone → typed alias), and the first level that finds anyone decides: one
--    organisation → matched; several → conflict, every candidate listed; nothing is guessed.
--  * At the code level a live campaign code (V65) gives campaign: credited to nobody, listed apart, never waiting in
--    Needs a decision.
--  * A value on the block list (partner.identifier_block) is ignored, even when an identifier holds it.
--  * An organisation's official and trade names never match (V421); a typed alias does, only on a row with no client ID
--    (V412). Nothing found: individual when a name is on the individuals list, else none.
-- finance.partner_match_unpinned keeps its shape and reads the detail; the pin still comes first (finance.partner_match).
-- Forward-only.

-- Whether a value of a kind is on the block list.
create function partner.is_blocked(p_kind text, p_key text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from partner.identifier_block b
                 where b.kind = p_kind and b.deleted_at is null
                   and ((b.match = 'exact' and b.value_key = p_key) or (b.match = 'domain' and p_key like '%@' || b.value_key)))
$$;

-- The organisations holding a live, unblocked identifier of these kinds and key on the day.
create function partner.holders(p_kinds text[], p_key text, p_day date, p_subkind text default null) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.array_agg(distinct d.partner_id order by d.partner_id)
  from partner.identifier d
  join partner.partner p on p.id = d.partner_id and p.merged_into_id is null
  where p_key is not null and d.kind = any (p_kinds) and d.value_key = p_key
    and (p_subkind is null or d.subkind = p_subkind)
    and partner.money_match(d, p_day) = 'match'
    and not partner.is_blocked(d.kind, d.value_key)
$$;

create function finance.match_detail(p_invoice uuid)
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
    if lvl = 'code' and v.code_key is not null then
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
comment on function finance.match_detail(uuid) is '§3.5: an invoice''s match before any pin — partner, state (matched · conflict · campaign · individual · unknown_client_id · none), the level that decided, the campaign code, and every candidate of a conflict.';

create or replace function finance.partner_match_unpinned(p_invoice uuid)
returns table (partner_id uuid, state text, level text)
language sql stable security definer set search_path = ''
as $$
  select d.partner_id, d.state, d.level from finance.match_detail(p_invoice) d
$$;

revoke all on function partner.is_blocked(text, text), partner.holders(text[], text, date, text),
  finance.match_detail(uuid) from public;
