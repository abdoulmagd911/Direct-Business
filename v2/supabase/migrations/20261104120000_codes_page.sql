-- Discount Codes page (owner decisions 4 Nov 2026): codes are standalone individual bookings, tracked for
-- targets, KPIs and audit, with their own ledger and a per-company view. A code is keyed by its identifier row id —
-- never by its text, which repeats under different ids. A code's use is recorded against an invoice by the invoice's
-- own number (finance.invoice.ref, the 10-digit number) only — never by DPIN, never by TTIN, never by a receipt
-- reference alone. The promo export carries no code column, so the import records the source promo here, at import
-- time (source = 'promo'); a person adds a use by hand with source = 'manual' and a reason.
--
-- Money figures reuse the Finance report's own counted units (finance.money_row): revenue is the invoice amount
-- less any wallet top-up, cost is approved expenses only, profit is revenue less cost, and a unit counts only once
-- fully paid (its status word maps to 'paid' in finance.status_map) and not excluded. A recorded use whose invoice
-- is not counted is listed apart and never enters a total. No VAT is shown or stored anywhere here. A figure with
-- nothing behind it stays empty, never 0. The per-company view is promo attribution only, kept apart from the
-- company's own totals and never added to them.
--
-- Landing order: this migration adds the tables and functions, but the page key 'codes' itself arrives with the
-- generated registry sync (pnpm registry:sync) from src/modules/codes/module.ts — that sync migration must be
-- applied AFTER this one, or authz.require('codes', …) answers 'none' for everyone. Forward-only (V103).

-- A recorded use of a code on one invoice: the discount as recorded, where it came from, and the Direct link
-- to that invoice as stored on the record (never a hard-coded link).
create table finance.code_use (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references partner.identifier (id),
  invoice_id uuid not null references finance.invoice (id),
  invoice_ref text not null check (pg_catalog.btrim(invoice_ref) <> '' and pg_catalog.length(invoice_ref) <= 60),
  discount_sar numeric(14, 2) not null check (discount_sar >= 0),
  source text not null check (source in ('promo', 'manual')),
  direct_url text check (direct_url is null or pg_catalog.btrim(direct_url) <> ''),
  reason text check (reason is null or pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index code_use_once on finance.code_use (code_id, invoice_id) where deleted_at is null;
create index code_use_invoice on finance.code_use (invoice_id) where deleted_at is null;
comment on table finance.code_use is 'One code used on one invoice (4 Nov 2026): the discount as recorded, its source (promo at import time, manual by hand), and the stored Direct link. Keyed by code id, matched by invoice number only.';

-- A code attributed to a company by hand, flagged promo: shown on the per-company view only, never mixed into
-- the company's own totals. This is NOT the identifier row's own partner — a code stays standalone.
create table finance.code_attribution (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references partner.identifier (id),
  partner_id uuid not null references partner.partner (id),
  is_promo boolean not null default true,
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index code_attribution_once on finance.code_attribution (code_id, partner_id) where deleted_at is null;
comment on table finance.code_attribution is 'A code shown under a company (4 Nov 2026): manual attribution, always flagged promo, kept apart from the company's own totals.';

-- A code's state from its dates, against today in Riyadh: expired once its last day has passed, inactive before
-- its first day, active in between (open ends count as live).
create function finance.code_state(p_valid_from date, p_valid_to date) returns text
language sql stable parallel safe set search_path = ''
as $$
  select case
           when p_valid_to is not null and p_valid_to < core.riyadh_today() then 'expired'
           when p_valid_from is not null and p_valid_from > core.riyadh_today() then 'inactive'
           else 'active' end
$$;

-- The codes list, keyed by identifier id, sorted by total discount first (highest first, codes with no counted
-- use last). Totals count counted units only; a code with no counted use carries empty totals, never 0.
create function finance.codes_list() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('codes', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.total_discount desc nulls last, r.code)
    from (
      select d.id, d.value_raw as code, d.valid_from, d.valid_to,
             finance.code_state(d.valid_from, d.valid_to) as state,
             disc.total_discount,
             money.total_collected, money.units
      from partner.identifier d
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

-- One code's detail: its ledger — every recorded use, each with the invoice's created date (the record date),
-- its counted revenue, cost and profit from the Finance report's own units, and its stored Direct link — counted
-- uses first, then uses that are not counted (listed apart, never in the totals), plus the totals over counted
-- uses only, and the code's company attributions.
create function finance.codes_detail(p_code uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  code_row partner.identifier;
begin
  perform authz.require('codes', 'view');
  select * into code_row from partner.identifier d
  where d.id = p_code and d.kind = 'discount_code' and d.deleted_at is null;
  if code_row.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object(
    'id', code_row.id,
    'code', code_row.value_raw,
    'valid_from', code_row.valid_from,
    'valid_to', code_row.valid_to,
    'state', finance.code_state(code_row.valid_from, code_row.valid_to),
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
        'id', a.id, 'partner_id', a.partner_id, 'partner_name', p.trade_name_en, 'is_promo', a.is_promo)
        order by p.trade_name_en)
      from finance.code_attribution a
      join partner.partner p on p.id = a.partner_id
      where a.code_id = code_row.id and a.deleted_at is null), '[]'::jsonb));
end
$$;

-- The per-company view: promo attribution only, separate totals per company, never the company's own totals.
create function finance.codes_by_company() returns jsonb
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
      select a.partner_id, p.trade_name_en as partner_name,
             pg_catalog.count(distinct a.code_id)::int as codes,
             sum(pc.total_discount) as total_discount,
             sum(pc.total_collected) as total_collected,
             sum(pc.total_profit) as total_profit
      from finance.code_attribution a
      join partner.partner p on p.id = a.partner_id
      left join per_code pc on pc.code_id = a.code_id
      where a.deleted_at is null and a.is_promo
      group by a.partner_id, p.trade_name_en
    ) r), '[]'::jsonb);
end
$$;

-- Record a use by hand (or, from the import, with source 'promo'): the invoice is found by its own number
-- alone — DPIN and TTIN are never used to find it, and a receipt reference alone never finds it either.
create function finance.code_use_add(p_code uuid, p_invoice_ref text, p_discount numeric,
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
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'invoice';
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

-- Remove a recorded use; the reason is required.
create function finance.code_use_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('codes', 'full');
  cur finance.code_use;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into cur from finance.code_use u where u.id = p_id and u.deleted_at is null for update;
  if cur.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'finance.code_use_removed',
                     pg_catalog.jsonb_build_object('invoice', cur.invoice_ref), p_reason);
  update finance.code_use set deleted_at = now(), deleted_by = me, delete_reason = p_reason, version = version + 1
  where id = cur.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version + 1, 'request_id', req);
end
$$;

-- Attribute a code to a company by hand: always flagged promo, with a reason.
create function finance.code_attribution_add(p_code uuid, p_partner uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('codes', 'full');
  code_row partner.identifier;
  partner_row partner.partner;
  rid uuid;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into code_row from partner.identifier d
  where d.id = p_code and d.kind = 'discount_code' and d.deleted_at is null;
  select * into partner_row from partner.partner p where p.id = p_partner and p.deleted_at is null;
  if code_row.id is null or partner_row.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  begin
    req := audit.begin('ui', 'finance.code_attribution_added',
                       pg_catalog.jsonb_build_object('code', code_row.value_raw, 'partner', partner_row.trade_name_en), p_reason);
    insert into finance.code_attribution (code_id, partner_id, is_promo, reason, created_by)
    values (code_row.id, partner_row.id, true, p_reason, me)
    returning id into rid;
    perform audit.end();
    return pg_catalog.jsonb_build_object('id', rid, 'version', 1, 'request_id', req);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.code_attribution_exists';
  end;
end
$$;

-- Remove an attribution; the reason is required.
create function finance.code_attribution_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('codes', 'full');
  cur finance.code_attribution;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into cur from finance.code_attribution a where a.id = p_id and a.deleted_at is null for update;
  if cur.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'finance.code_attribution_removed',
                     pg_catalog.jsonb_build_object('partner', cur.partner_id), p_reason);
  update finance.code_attribution set deleted_at = now(), deleted_by = me, delete_reason = p_reason, version = version + 1
  where id = cur.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version + 1, 'request_id', req);
end
$$;

-- The browser's doors (security invoker, like every other api.* wrapper): the work function checks access.
create function api.codes_list() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.codes_list() $$;
create function api.codes_detail(p_code uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.codes_detail(p_code) $$;
create function api.codes_by_company() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.codes_by_company() $$;
create function api.code_use_add(p_code uuid, p_invoice_ref text, p_discount numeric,
                                 p_source text default 'manual', p_direct_url text default null,
                                 p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.code_use_add(p_code, p_invoice_ref, p_discount, p_source, p_direct_url, p_reason) $$;
create function api.code_use_remove(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.code_use_remove(p_id, p_reason) $$;
create function api.codes_attribution_add(p_code uuid, p_partner uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.code_attribution_add(p_code, p_partner, p_reason) $$;
create function api.codes_attribution_remove(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.code_attribution_remove(p_id, p_reason) $$;

revoke all on function finance.code_state(date, date), finance.codes_list(), finance.codes_detail(uuid),
  finance.codes_by_company(), finance.code_use_add(uuid, text, numeric, text, text, text),
  finance.code_use_remove(uuid, text), finance.code_attribution_add(uuid, uuid, text),
  finance.code_attribution_remove(uuid, text), api.codes_list(), api.codes_detail(uuid), api.codes_by_company(),
  api.code_use_add(uuid, text, numeric, text, text, text), api.code_use_remove(uuid, text),
  api.codes_attribution_add(uuid, uuid, text), api.codes_attribution_remove(uuid, text) from public;
grant execute on function finance.code_state(date, date), finance.codes_list(), finance.codes_detail(uuid),
  finance.codes_by_company(), finance.code_use_add(uuid, text, numeric, text, text, text),
  finance.code_use_remove(uuid, text), finance.code_attribution_add(uuid, uuid, text),
  finance.code_attribution_remove(uuid, text), api.codes_list(), api.codes_detail(uuid), api.codes_by_company(),
  api.code_use_add(uuid, text, numeric, text, text, text), api.code_use_remove(uuid, text),
  api.codes_attribution_add(uuid, uuid, text), api.codes_attribution_remove(uuid, text) to authenticated;
