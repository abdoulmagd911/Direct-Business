-- Sabotage: a-dpin-does-not-say-issued
-- Breaks: sql:DPN-01
-- Expect: a row recorded here with a DPIN says its tax invoice is issued
-- A row carrying a DPIN is not marked as having its tax invoice issued.
create or replace function finance.ledger_marks(p_answer jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  with listed as (
    select 'rows'::text as part, t.r, t.o from pg_catalog.jsonb_array_elements(coalesce(p_answer -> 'rows', '[]'::jsonb)) with ordinality t(r, o)
    union all
    select 'not_yet_counted', t.r, t.o from pg_catalog.jsonb_array_elements(coalesce(p_answer -> 'not_yet_counted', '[]'::jsonb)) with ordinality t(r, o)
  ),
  keyed as materialized (
    select l.part, l.r, l.o, l.r ->> 'source' as source,
           case when l.r ->> 'source' = 'manual' and (l.r ->> 'invoice_id') ~ '^[0-9a-f-]{36}$' then (l.r ->> 'invoice_id')::uuid end as invoice_id,
           nullif(l.r ->> 'source_partner_id', '')::uuid as source_partner_id,
           coalesce(l.r ->> 'number', l.r ->> 'transaction_number', l.r ->> 'invoice_number') as number,
           l.r ->> 'dpin' as dpin
    from listed l
  ),
  kinds as materialized (
    select s.partner_id, finance.partner_deal_type(s.partner_id) as kind
    from (select distinct source_partner_id as partner_id from keyed where source_partner_id is not null) s
  ),
  -- the imported rows of the organisations on the list, one per organisation and number (a transaction's row before
  -- an invoice-only row that carries the same number), so each listed row meets its own in one hashed join
  imported as materialized (
    select distinct on (x.partner_id, coalesce(x.transaction_ref, x.invoice_ref))
           x.partner_id, coalesce(x.transaction_ref, x.invoice_ref) as number,
           x.deal_type, x.attribution_promo or x.source_promo is not null as has_code, x.tax_no
    from work.import_record x
    where x.deleted_at is null and x.kind in ('transaction', 'invoice')
      and x.partner_id in (select k.partner_id from kinds k)
    order by x.partner_id, coalesce(x.transaction_ref, x.invoice_ref), x.transaction_ref nulls last
  ),
  typed as (
    select k.part, k.o, k.r, i.commission_type, d.deal_type, d.deal_type_by,
           coalesce(case when k.source = 'manual' then i.id is not null and k.dpin is not null
                         else k.dpin ~* '^\s*DPIN' or c.tax_no ~* '^\s*DPIN' end, false) as issued
    from keyed k
    left join finance.invoice i on i.id = k.invoice_id
    left join lateral (select x.subkind from partner.identifier x
                       where i.id is not null and x.deleted_at is null and x.kind = 'payments_client_id'
                         and x.value_key = i.client_id_key
                       limit 1) cid on true
    left join imported c on k.source = 'import' and c.partner_id = k.source_partner_id and c.number = k.number
    left join kinds kd on kd.partner_id = k.source_partner_id
    cross join lateral finance.deal_rule(
      case when k.source = 'manual' then i.deal_type else c.deal_type end,
      case when k.source = 'manual' then cid.subkind end,
      case when k.source = 'manual' then i.code_key is not null else coalesce(c.has_code, false) end,
      kd.kind) d
  ),
  done as (
    select t.part, t.o, t.deal_type,
           t.r || pg_catalog.jsonb_build_object(
             'deal_type', t.deal_type, 'deal_type_by', t.deal_type_by,
             'receivable', t.part = 'rows' and coalesce((t.r ->> 'counted')::boolean, true) and t.deal_type = 'postpaid',
             'tax_invoice_issued', false, 'commission_type', t.commission_type) as r
    from typed t
  )
  select pg_catalog.jsonb_build_object(
    'rows', coalesce((select pg_catalog.jsonb_agg(d.r order by d.o) from done d where d.part = 'rows'), '[]'::jsonb),
    'not_yet_counted', coalesce((select pg_catalog.jsonb_agg(d.r order by d.o) from done d where d.part = 'not_yet_counted'), '[]'::jsonb),
    'by_deal_type', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'deal_type', g.deal_type, 'units', g.units, 'revenue', g.revenue, 'cost', g.cost, 'profit', g.profit,
               'without_cost', g.without_cost)
             order by case g.deal_type when 'prepaid' then 1 when 'postpaid' then 2 when 'tender' then 3 when 'promo' then 4 else 5 end)
      from (select d.deal_type, pg_catalog.count(*)::int as units,
                   coalesce(pg_catalog.sum((d.r ->> 'revenue')::numeric), 0) as revenue,
                   pg_catalog.sum((d.r ->> 'cost')::numeric) as cost,
                   pg_catalog.sum((d.r ->> 'profit')::numeric) as profit,
                   pg_catalog.count(*) filter (where (d.r ->> 'cost') is null)::int as without_cost
            from done d
            where d.part = 'rows' and coalesce((d.r ->> 'counted')::boolean, true)
            group by d.deal_type) g), '[]'::jsonb),
    'can_set_deal_type', authz.level_of(authz.me(), 'finance') >= 'full')
$$;
