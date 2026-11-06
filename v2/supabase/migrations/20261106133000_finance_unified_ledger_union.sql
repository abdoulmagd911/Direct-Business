-- Fix20 (6 Nov 2026): the unified ledger read failed live with Postgres 42601
-- "each UNION query must have the same number of columns" on every call, so the
-- Finance page ledger could not load at all. In combined_rows the manual branch
-- selected 14 columns and the import branch 15: the manual branch forgot
-- amount_sar (manual_rows already carries it as null::numeric; the import branch
-- and deduped both expect it). One column added; nothing else changes. The
-- function signature is unchanged, so the grants and the generated types are
-- untouched. Forward-only (V103): the pilot migration is applied, never edited.
-- Regression test: UNI-01 (calls the read with a manual row and an imported row).

create or replace function finance.unified_ledger(
  p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  manual jsonb;
  client_key text := case when pg_catalog.btrim(coalesce(p_client_id, '')) = '' then null
                          else norm.digits_key(p_client_id, true) end;
  code_key text := case when pg_catalog.btrim(coalesce(p_code, '')) = '' then null
                         else norm.code_key(p_code) end;
  code_view boolean := p_code is not null and pg_catalog.btrim(p_code) <> '';
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  if p_kind is not null and p_kind not in ('transaction', 'standalone', 'billing', 'credit_note', 'wallet_topup') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end if;
  manual := finance.ledger(p_from, p_to, p_partner, p_client_id, p_kind, p_code, p_project);

  return (
    with manual_rows as (
      select (r ->> 'invoice_id') as invoice_id, (r ->> 'unit_kind') as unit_kind,
             (r ->> 'transaction_number') as transaction_number, (r ->> 'invoice_number') as invoice_number,
             (r ->> 'partner_id')::uuid as partner_id, (r ->> 'created_on')::date as created_on,
             (r ->> 'revenue')::numeric as revenue, (r ->> 'cost')::numeric as cost,
             (r ->> 'profit')::numeric as profit, (r ->> 'dpin') as dpin,
             (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(r -> 'flags') x) as flags,
             'manual'::text as source, false as is_promo, null::numeric as discount_sar,
             null::numeric as amount_sar
      from pg_catalog.jsonb_array_elements(manual -> 'rows') r
    ),
    manual_invoices as (
      select (v ->> 'invoice_id') as invoice_id, (v ->> 'invoice_number') as invoice_number,
             (v ->> 'kind') as kind, (v ->> 'partner_id')::uuid as partner_id,
             (v ->> 'total_sar')::numeric as total_sar, (v ->> 'received_sar')::numeric as received_sar,
             (v ->> 'remaining_sar')::numeric as remaining_sar, (v ->> 'dpin') as dpin,
             (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(v -> 'transactions') x) as transactions
      from pg_catalog.jsonb_array_elements(manual -> 'invoices') v
    ),
    manual_by_company as (
      select (c ->> 'partner_id')::uuid as partner_id, (c ->> 'units')::int as units,
             (c ->> 'revenue')::numeric as revenue, (c ->> 'cost')::numeric as cost,
             (c ->> 'profit')::numeric as profit, (c ->> 'without_cost')::int as without_cost,
             (c ->> 'received')::numeric as received, (c ->> 'remaining')::numeric as remaining
      from pg_catalog.jsonb_array_elements(manual -> 'by_company') c
    ),
    manual_companies as (
      select (c ->> 'partner_id')::uuid as partner_id, (c ->> 'partner_number') as partner_number,
             (c ->> 'trade_name_en') as trade_name_en, (c ->> 'trade_name_ar') as trade_name_ar,
             (c ->> 'units')::int as units
      from pg_catalog.jsonb_array_elements(manual -> 'companies') c
    ),
    -- Imported money rows: one row per transaction or invoice, fully paid
    -- only, with an invoice-only row dropped when its transactions are
    -- already there. Expense rows and promo holdings are never Finance
    -- rows (see the header).
    import_base as (
      select r.id, r.partner_id, r.kind, r.transaction_ref, r.invoice_ref, r.tax_no,
             r.record_date, r.amount_sar, r.revenue_sar, r.cost_sar, r.profit_sar,
             r.promo_discount_sar, r.source_promo, r.attribution_promo,
             r.missing_transaction, r.missing_invoice, r.cost_pending, r.provisional,
             case when r.kind = 'transaction' then 'transaction'
                  when r.transaction_ref is not null then 'transaction'
                  else 'standalone' end as mapped_kind,
             (select pg_catalog.array_agg(f) from pg_catalog.unnest(array[
                case when r.missing_transaction then 'missing_transaction' end,
                case when r.missing_invoice then 'missing_invoice' end,
                case when r.cost_pending then 'cost_pending' end,
                case when r.provisional then 'waiting_for_issuing' end
              ]) f where f is not null) as flags
      from work.import_record r
      where r.deleted_at is null and r.kind in ('transaction', 'invoice')
        and r.fully_paid and r.revenue_sar is not null
        and r.record_date between p_from and p_to
        and (p_partner is null or r.partner_id = p_partner)
        and (client_key is null or exists (select 1 from partner.identifier d where d.deleted_at is null
             and d.kind = 'payments_client_id' and d.value_key = client_key and d.partner_id = r.partner_id))
        and (p_kind is null
             or (p_kind = 'transaction' and (r.kind = 'transaction' or r.transaction_ref is not null))
             or (p_kind = 'standalone' and r.kind = 'invoice' and r.transaction_ref is null))
        and not (r.kind = 'invoice' and r.transaction_ref is null and exists (
              select 1 from work.import_record t where t.deleted_at is null and t.partner_id = r.partner_id
                and t.transaction_ref is not null and t.invoice_ref = r.invoice_ref))
    ),
    import_main as (
      select * from import_base
      where not code_view
        and not attribution_promo
    ),
    import_code_rows as (
      select * from import_base
      where code_view
        and (source_promo = p_code or norm.code_key(source_promo) = code_key)
    ),
    -- The rows of the view: manually recorded rows plus imported rows.
    -- On a code view, only code-linked imported rows belong here.
    combined_rows as (
      select invoice_id, unit_kind, transaction_number, invoice_number, partner_id, created_on,
             revenue, cost, profit, dpin, flags, source, is_promo, discount_sar, amount_sar
      from manual_rows
      union all
      select 'import:' || coalesce(invoice_ref, transaction_ref, id::text) as invoice_id,
             mapped_kind as unit_kind, transaction_ref as transaction_number,
             invoice_ref as invoice_number, partner_id, record_date as created_on,
             revenue_sar as revenue, cost_sar as cost, profit_sar as profit, tax_no as dpin,
             flags, 'import'::text as source, attribution_promo as is_promo,
             promo_discount_sar as discount_sar, amount_sar
      from (select * from import_main
            union all
            select * from import_code_rows) all_import
    ),
    -- The two import arms are disjoint by construction (import_main is
    -- empty on a code view, import_code_rows is empty otherwise), so
    -- the distinct below is only a safety net. Manual rows keep their
    -- own keys and are never deduped against imported rows: the two
    -- stores never share an id.
    deduped as (
      select distinct on (source, invoice_id, unit_kind, transaction_number, invoice_number)
             invoice_id, unit_kind, transaction_number, invoice_number, partner_id, created_on,
             revenue, cost, profit, dpin, flags, source, is_promo, discount_sar, amount_sar
      from combined_rows
      order by source, invoice_id, unit_kind, transaction_number nulls last, invoice_number nulls last
    ),
    -- Promo rows apart from the totals on a plain view: every imported
    -- row that carries a code attribution, plus every promo holding row,
    -- whether fully paid or not (counted says whether it counts for a code).
    promo_rows as (
      select r.id, r.partner_id, r.transaction_ref, r.invoice_ref, r.record_date,
             r.source_promo as code, r.promo_discount_sar as discount_sar,
             r.revenue_sar as revenue, r.cost_sar as cost, r.profit_sar as profit,
             r.fully_paid as counted, r.direct_url
      from work.import_record r
      where r.deleted_at is null and not code_view
        and (r.attribution_promo or r.kind = 'promo')
        and r.record_date between p_from and p_to
        and (p_partner is null or r.partner_id = p_partner)
        and (client_key is null or exists (select 1 from partner.identifier d where d.deleted_at is null
             and d.kind = 'payments_client_id' and d.value_key = client_key and d.partner_id = r.partner_id))
    ),
    import_by_company as (
      select partner_id, pg_catalog.count(*)::int as units,
             coalesce(pg_catalog.sum(revenue), 0) as revenue,
             coalesce(pg_catalog.sum(cost) filter (where cost is not null), 0) as cost,
             coalesce(pg_catalog.sum(profit) filter (where profit is not null), 0) as profit,
             pg_catalog.count(*) filter (where cost is null)::int as without_cost,
             coalesce(pg_catalog.sum(amount_for_received), 0) as received,
             0::numeric as remaining
      from (select partner_id, revenue, cost, profit, amount_sar as amount_for_received from deduped where source = 'import') s
      group by partner_id
    ),
    -- Invoices from the same imported rows as the totals (not from
    -- every imported row), so the list never shows an invoice the
    -- totals did not count. The total is the invoice amount itself
    -- (not revenue, which has the wallet part taken off); a fully
    -- paid invoice has all of it received and nothing remaining.
    import_view_rows as (
      select distinct on (id) * from (
        select * from import_main union all select * from import_code_rows) u
    ),
    import_invoices as (
      select 'import:' || invoice_ref as invoice_id, invoice_ref as invoice_number,
             pg_catalog.min(mapped_kind) as kind, partner_id,
             coalesce(pg_catalog.max(case when transaction_ref is null then amount_sar end),
                      pg_catalog.sum(amount_sar)) as total_sar,
             coalesce(pg_catalog.max(case when transaction_ref is null then amount_sar end),
                      pg_catalog.sum(amount_sar)) as received_sar,
             0::numeric as remaining_sar, pg_catalog.max(tax_no) as dpin,
             coalesce(pg_catalog.array_agg(transaction_ref) filter (where transaction_ref is not null), '{}') as transactions
      from import_view_rows
      where invoice_ref is not null
      group by partner_id, invoice_ref
    ),
    import_companies as (
      select partner_id, pg_catalog.count(*)::int as units from deduped where source = 'import' group by partner_id
    ),
    by_company as (
      select coalesce(m.partner_id, i.partner_id) as partner_id,
             coalesce(m.units, 0) + coalesce(i.units, 0) as units,
             coalesce(m.revenue, 0) + coalesce(i.revenue, 0) as revenue,
             coalesce(m.cost, 0) + coalesce(i.cost, 0) as cost,
             coalesce(m.profit, 0) + coalesce(i.profit, 0) as profit,
             coalesce(m.without_cost, 0) + coalesce(i.without_cost, 0) as without_cost,
             coalesce(m.received, 0) + coalesce(i.received, 0) as received,
             coalesce(m.remaining, 0) + coalesce(i.remaining, 0) as remaining
      from manual_by_company m full join import_by_company i on coalesce(i.partner_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(m.partner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ),
    companies as (
      select coalesce(m.partner_id, i.partner_id) as partner_id,
             coalesce(m.partner_number, p.number) as partner_number,
             coalesce(m.trade_name_en, p.trade_name_en) as trade_name_en,
             coalesce(m.trade_name_ar, p.trade_name_ar) as trade_name_ar,
             coalesce(m.units, 0) + coalesce(i.units, 0) as units
      from manual_companies m full join import_companies i on coalesce(i.partner_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(m.partner_id, '00000000-0000-0000-0000-000000000000'::uuid)
      left join partner.partner p on p.id = coalesce(m.partner_id, i.partner_id)
    ),
    unconfirmed as (
      select pg_catalog.count(*)::int as units
      from work.import_record r
      where r.deleted_at is null and r.kind in ('transaction', 'invoice') and not r.fully_paid
        and r.record_date between p_from and p_to
        and (p_partner is null or r.partner_id = p_partner)
    ),
    code_discount as (
      select case when not code_view then null else
        coalesce((
          select pg_catalog.sum(u.discount_sar) from finance.code_use u
          join partner.identifier d on d.id = u.code_id and d.deleted_at is null
          where u.deleted_at is null and d.value_raw = p_code
            and exists (select 1 from finance.money_row m where m.invoice_id = u.invoice_id and m.counted)), 0)
        + coalesce((
          select pg_catalog.sum(x.discount_sar) from (
            select distinct on (invoice_ref) invoice_ref, promo_discount_sar as discount_sar
            from work.import_record r
            where r.deleted_at is null and r.fully_paid and r.promo_discount_sar is not null
              and (r.source_promo = p_code or norm.code_key(r.source_promo) = code_key)
            order by invoice_ref, record_date desc nulls last) x), 0)
      end as discount
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'partner', p_partner, 'client_id', p_client_id, 'kind', p_kind, 'code', p_code,
      'project', (manual ->> 'project'),
      'totals', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from deduped),
        'revenue', (select coalesce(pg_catalog.sum(revenue), 0) from deduped),
        'cost', (select coalesce(pg_catalog.sum(cost) filter (where cost is not null), 0) from deduped),
        'profit', (select coalesce(pg_catalog.sum(profit) filter (where profit is not null), 0) from deduped),
        'without_cost', (select pg_catalog.count(*) from deduped where cost is null),
        'received', (select coalesce(pg_catalog.sum(received_sar), 0) from (
          select received_sar from manual_invoices union all select received_sar from import_invoices) all_inv),
        'remaining', (select coalesce(pg_catalog.sum(remaining_sar), 0) from (
          select remaining_sar from manual_invoices union all select remaining_sar from import_invoices) all_inv2),
        'manual_units', (select pg_catalog.count(*) from deduped where source = 'manual'),
        'import_units', (select pg_catalog.count(*) from deduped where source = 'import'),
        'promo_units', (select pg_catalog.count(*) from promo_rows),
        'unconfirmed_import_units', (select units from unconfirmed)),
      'companies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.trade_name_en nulls last)
                             from companies c), '[]'::jsonb),
      'by_company', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) order by b.partner_id nulls last)
                              from by_company b), '[]'::jsonb),
      'invoices', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) order by v.invoice_number nulls last)
                            from (select * from manual_invoices union all select * from import_invoices) v), '[]'::jsonb),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'invoice_id', r.invoice_id, 'unit_kind', r.unit_kind, 'transaction_number', r.transaction_number,
          'invoice_number', r.invoice_number, 'partner_id', r.partner_id, 'created_on', r.created_on,
          'revenue', r.revenue, 'cost', r.cost, 'profit', r.profit, 'dpin', r.dpin,
          'flags', coalesce(pg_catalog.to_jsonb(r.flags), '[]'::jsonb),
          'source', r.source, 'is_promo', r.is_promo, 'discount_sar', r.discount_sar)
          order by r.created_on desc nulls last, r.transaction_number nulls last)
                        from (select * from deduped order by created_on desc nulls last, transaction_number nulls last limit 1000) r), '[]'::jsonb),
      'truncated', (select (manual ->> 'truncated')::boolean or (select pg_catalog.count(*) from deduped) > 1000),
      'promo_rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(pr) order by pr.record_date desc nulls last)
                              from promo_rows pr), '[]'::jsonb),
      'code_discount', (select discount from code_discount)
    )
  );
end
$$;
