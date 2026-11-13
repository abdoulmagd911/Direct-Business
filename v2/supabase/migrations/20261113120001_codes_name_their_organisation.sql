-- Owner 13 Nov, Clients audit (B-partners) — the Discount codes page names whose code each one is.
--
-- A discount code is an identifier of one organisation (partner.identifier.partner_id), but the codes list and a
-- code's detail never said which: a person reading "FIXTURE10" on /codes had no way to tell the client it belongs to.
-- codes_list and codes_detail now also answer partner_id, partner_name and partner_name_ar (the organisation's trade
-- names, so the screen names it in the reader's language and links it); the attributions and the per-organisation
-- view gain partner_name_ar beside the English name they already carried. Nothing else changes — every total is
-- computed exactly as before (the money reads are copied unchanged). No signature change, so CREATE OR REPLACE keeps
-- the grants and the generated types. Copied whole from 20261104120000 (codes_list, codes_by_company) and
-- 20261109000002 (codes_detail, keeping fee_percent). Forward-only (V103).

create or replace function finance.codes_list() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('codes', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.total_discount desc nulls last, r.code)
    from (
      select d.id, d.value_raw as code, d.valid_from, d.valid_to,
             finance.code_state(d.valid_from, d.valid_to) as state,
             disc.total_discount,
             money.total_collected, money.units,
             -- whose code it is
             p.id as partner_id, p.trade_name_en as partner_name, p.trade_name_ar as partner_name_ar
      from partner.identifier d
      left join partner.partner p on p.id = d.partner_id and p.deleted_at is null
      left join lateral (
        -- The discount is counted once per recorded use, never once per money row: an invoice can carry
        -- more than one counted unit (a billing invoice's own unit and its monthly-fee unit), and joining
        -- the discount to the units would count it twice.
        select sum(u.discount_sar) as total_discount
        from finance.code_use u
        where u.code_id = d.id and u.deleted_at is null
          and exists (select 1 from finance.money_row m where m.invoice_id = u.invoice_id and m.counted)
      ) disc on true
      left join lateral (
        select sum(m.revenue) as total_collected, pg_catalog.count(*)::int as units
        from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = d.id and u.deleted_at is null
      ) money on true
      where d.kind = 'discount_code' and d.deleted_at is null
    ) r), '[]'::jsonb);
end
$$;

create or replace function finance.codes_detail(p_code uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  code_row partner.identifier;
  owner_row partner.partner;
begin
  perform authz.require('codes', 'view');
  select * into code_row from partner.identifier d
  where d.id = p_code and d.kind = 'discount_code' and d.deleted_at is null;
  if code_row.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into owner_row from partner.partner p where p.id = code_row.partner_id and p.deleted_at is null;
  return pg_catalog.jsonb_build_object(
    'id', code_row.id,
    'code', code_row.value_raw,
    'valid_from', code_row.valid_from,
    'valid_to', code_row.valid_to,
    'state', finance.code_state(code_row.valid_from, code_row.valid_to),
    -- whose code it is
    'partner_id', owner_row.id,
    'partner_name', owner_row.trade_name_en,
    'partner_name_ar', owner_row.trade_name_ar,
    'fee_percent', (
      select t.fee_percent from partner.code_terms t
      where t.identifier_id = code_row.id and t.deleted_at is null
      order by t.effective_from desc, t.created_at desc limit 1),
    'totals', pg_catalog.jsonb_build_object(
      'total_discount', (
        select sum(u.discount_sar) from finance.code_use u
        where u.code_id = code_row.id and u.deleted_at is null
          and exists (select 1 from finance.money_row m where m.invoice_id = u.invoice_id and m.counted)),
      'total_collected', (
        select sum(m.revenue) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_cost', (
        select sum(m.cost) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_profit', (
        select sum(m.profit) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'units', (
        select pg_catalog.count(*)::int from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null)),
    'ledger', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.counted desc, l.created_on)
      from (
        select u.id as use_id, u.invoice_id, u.invoice_ref as ref, i.created_on, i.status_raw as status_word,
               u.discount_sar, u.source, u.direct_url,
               (select coalesce(pg_catalog.bool_and(m.counted), false) from finance.money_row m where m.invoice_id = u.invoice_id) as counted,
               (select sum(m.revenue) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as revenue,
               (select sum(m.cost) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as cost,
               (select sum(m.profit) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as profit,
               (select min(m.excluded_reason) from finance.money_row m where m.invoice_id = u.invoice_id) as excluded_reason
        from finance.code_use u
        join finance.invoice i on i.id = u.invoice_id
        where u.code_id = code_row.id and u.deleted_at is null
      ) l), '[]'::jsonb),
    'attributions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.id, 'partner_id', a.partner_id, 'partner_name', p.trade_name_en, 'partner_name_ar', p.trade_name_ar,
        'is_promo', a.is_promo)
        order by p.trade_name_en)
      from finance.code_attribution a
      join partner.partner p on p.id = a.partner_id
      where a.code_id = code_row.id and a.deleted_at is null), '[]'::jsonb));
end
$$;

create or replace function finance.codes_by_company() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('codes', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.total_discount desc nulls last, r.partner_name)
    from (
      with per_code as (
        select u.code_id,
               (select sum(u2.discount_sar) from finance.code_use u2
                where u2.code_id = u.code_id and u2.deleted_at is null
                  and exists (select 1 from finance.money_row m2 where m2.invoice_id = u2.invoice_id and m2.counted)
               ) as total_discount,
               sum(m.revenue) as total_collected,
               sum(m.profit) as total_profit
        from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.deleted_at is null
        group by u.code_id
      )
      select a.partner_id, p.trade_name_en as partner_name, p.trade_name_ar as partner_name_ar,
             pg_catalog.count(distinct a.code_id)::int as codes,
             sum(pc.total_discount) as total_discount,
             sum(pc.total_collected) as total_collected,
             sum(pc.total_profit) as total_profit
      from finance.code_attribution a
      join partner.partner p on p.id = a.partner_id
      left join per_code pc on pc.code_id = a.code_id
      where a.deleted_at is null and a.is_promo
      group by a.partner_id, p.trade_name_en, p.trade_name_ar
    ) r), '[]'::jsonb);
end
$$;

-- Record a use: an invoice number no invoice carries is refused as finance.code_use_no_invoice, naming the number
-- typed — it read "This record was not found", which did not say what was wrong. Copied whole from 20261104120000;
-- only that one refusal changes. No signature change.
create or replace function finance.code_use_add(p_code uuid, p_invoice_ref text, p_discount numeric,
                                                p_source text default 'manual', p_direct_url text default null,
                                                p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('codes', 'full');
  code_row partner.identifier;
  inv finance.invoice;
  rid uuid;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_invoice_ref, '')) = '' or p_discount is null or p_discount < 0
     or p_source not in ('promo', 'manual')
     or (p_source = 'manual' and pg_catalog.btrim(coalesce(p_reason, '')) = '') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
  end if;
  select * into code_row from partner.identifier d
  where d.id = p_code and d.kind = 'discount_code' and d.deleted_at is null;
  if code_row.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into inv from finance.invoice i where i.ref = p_invoice_ref and i.deleted_at is null;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'finance.code_use_no_invoice', detail = p_invoice_ref;
  end if;
  begin
    req := audit.begin('ui', 'finance.code_use_added',
                       pg_catalog.jsonb_build_object('code', code_row.value_raw, 'invoice', p_invoice_ref), p_reason);
    insert into finance.code_use (code_id, invoice_id, invoice_ref, discount_sar, source, direct_url, reason, created_by)
    values (code_row.id, inv.id, p_invoice_ref, p_discount, p_source, nullif(pg_catalog.btrim(coalesce(p_direct_url, '')), ''), p_reason, me)
    returning id into rid;
    perform audit.end();
    return pg_catalog.jsonb_build_object('id', rid, 'version', 1, 'request_id', req);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.code_use_exists', detail = p_invoice_ref;
  end;
end
$$;
