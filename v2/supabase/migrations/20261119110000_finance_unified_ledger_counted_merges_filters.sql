-- Landing 32 (Finance F-B) — the unified Ledger: A2 (Counted? on every row, the lists applied), A4 (the code
-- view's discount respects the dates and the organisation) and A5 (an unknown cost is empty, never 0).
--
-- Same signature, same grants; one forward-only redefinition. What changes in the answer:
--   rows[]        — every row says `counted` (true/false) and, where not, `excluded_by` + `not_counted_reason`;
--                   a row a rule or the Admin excluded is LISTED (never removed), out of every total. Also on a
--                   row: `number` (its own number — the key Exclude / Include takes), `source_partner_id` (the
--                   organisation it is recorded under), `partner_id` (the organisation it counts under after the
--                   merge list), `merged_by`, `excluded_row_level` (excluded by hand, so Include can undo it) and
--                   `code_state` ('not_found' → "Code has not been found", 'ambiguous' → held for a person).
--   totals        — counted rows only; `cost` and `profit` are NULL when no counted row has a cost (A5);
--                   `excluded_units` / `excluded_revenue` beside them.
--   by_company[]  — per organisation AFTER the merge list, built from the same rows as the totals; `cost` and
--                   `profit` NULL when none of that organisation's rows has a cost.
--   promo_rows[]  — the promo pool: a row whose code is merged into an organisation has left it.
--   code_discount — on a code view, the discount of the uses INSIDE the period and the organisation / client
--                   filter asked for (A4). Before, it was every use of the code, all time, all organisations.
--   can_toggle    — whether the reader may Exclude / Include (admins).
--
-- The merge list. A row counts under coalesce(merged organisation, its own). For a row recorded here the
-- client ID and the code are on the invoice itself; for an imported row see finance.import_unit. When one
-- organisation is asked for (p_partner), the rows merged INTO it are fetched too (the manual ledger is asked
-- again by each merged client ID and code), and the rows merged AWAY from it are left out.
--
-- The dedup across the two stores is unchanged (L18, UNI-03, FND-09): organisation + kind + number, on the
-- organisation the row is RECORDED under — two organisations merged into one keep both their documents.

create or replace function finance.unified_ledger(
  p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  manual jsonb;
  extra jsonb;
  m_rows jsonb;
  m_invoices jsonb;
  m_truncated boolean;
  rule record;
  client_key text := case when pg_catalog.btrim(coalesce(p_client_id, '')) = '' then null
                          else norm.digits_key(p_client_id, true) end;
  wanted_code text := case when pg_catalog.btrim(coalesce(p_code, '')) = '' then null
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
  m_rows := coalesce(manual -> 'rows', '[]'::jsonb);
  m_invoices := coalesce(manual -> 'invoices', '[]'::jsonb);
  m_truncated := coalesce((manual ->> 'truncated')::boolean, false);
  -- the rows recorded here that the merge list brings INTO the organisation asked for
  if p_partner is not null then
    for rule in select m.kind, m.value_raw from finance.merge_rule m
                where m.deleted_at is null and m.partner_id = p_partner loop
      if rule.kind = 'client_id' and client_key is null then
        extra := finance.ledger(p_from, p_to, null, rule.value_raw, p_kind, p_code, p_project);
      elsif rule.kind = 'discount_code' and not code_view then
        extra := finance.ledger(p_from, p_to, null, null, p_kind, rule.value_raw, p_project);
      else
        continue;
      end if;
      m_rows := m_rows || coalesce(extra -> 'rows', '[]'::jsonb);
      m_invoices := m_invoices || coalesce(extra -> 'invoices', '[]'::jsonb);
      m_truncated := m_truncated or coalesce((extra ->> 'truncated')::boolean, false);
    end loop;
  end if;

  return (
    with
    -- the organisation an invoice recorded here counts under: its code's merge, else its client ID's
    manual_merge as (
      select i.id as invoice_id, mg.partner_id as merged_partner_id, mg.kind as merged_by
      from finance.invoice i
      join lateral (
        select m.partner_id, m.kind from finance.merge_rule m
        where m.deleted_at is null
          and ((m.kind = 'discount_code' and m.value_key = i.code_key)
               or (m.kind = 'client_id' and m.value_key = i.client_id_key))
        order by case m.kind when 'discount_code' then 0 else 1 end
        limit 1) mg on true
      where i.deleted_at is null
    ),
    manual_counted as (
      select distinct on (r ->> 'invoice_id', r ->> 'unit_kind')
             (r ->> 'invoice_id') as invoice_id, (r ->> 'unit_kind') as unit_kind,
             (r ->> 'transaction_number') as transaction_number, (r ->> 'invoice_number') as invoice_number,
             (r ->> 'partner_id')::uuid as source_partner_id, (r ->> 'created_on')::date as created_on,
             (r ->> 'revenue')::numeric as revenue, (r ->> 'cost')::numeric as cost,
             (r ->> 'profit')::numeric as profit, (r ->> 'dpin') as dpin,
             (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(r -> 'flags') x) as flags
      from pg_catalog.jsonb_array_elements(m_rows) r
      order by r ->> 'invoice_id', r ->> 'unit_kind'
    ),
    -- the units recorded here that a rule or the Admin excluded: listed, never counted. The same filters as
    -- the counted ones (finance.ledger), read from money_row itself, which finance.ledger leaves out.
    manual_excluded as (
      select r.invoice_id::text as invoice_id, r.unit_kind,
             case when r.unit_kind = 'transaction' then r.ref end as transaction_number,
             case when r.unit_kind <> 'transaction' then r.ref end as invoice_number,
             r.partner_id as source_partner_id, r.created_on, r.revenue,
             r.excluded_by, r.excluded_reason, x.partner_id is not null as excluded_row_level
      from finance.money_row r
      join finance.invoice i on i.id = r.invoice_id
      left join lateral finance.exclusion_of(r.invoice_id) x on x.id is not null
      where r.excluded_by is not null
        and r.created_on between p_from and p_to
        and (client_key is null or i.client_id_key = client_key
             or exists (select 1 from partner.identifier d where d.deleted_at is null
                        and d.kind = 'payments_client_id' and d.value_key = client_key
                        and d.partner_id = r.partner_id))
        and (wanted_code is null or i.code_key = wanted_code)
        and (p_kind is null
             or (p_kind = 'transaction' and r.unit_kind = 'transaction')
             or (p_kind = 'standalone' and r.unit_kind = 'standalone')
             or (p_kind = 'billing' and r.unit_kind = 'monthly_fee'))
        and p_project is null
    ),
    manual_rows as (
      select c.invoice_id, c.unit_kind, c.transaction_number, c.invoice_number, c.source_partner_id,
             coalesce(g.merged_partner_id, c.source_partner_id) as partner_id, g.merged_by,
             c.created_on, c.revenue, c.cost, c.profit, c.dpin, c.flags,
             'manual'::text as source, false as is_promo, null::numeric as discount_sar, null::numeric as amount_sar,
             true as counted, null::text as excluded_by, null::text as not_counted_reason,
             false as excluded_row_level, null::text as code_state
      from manual_counted c
      left join manual_merge g on g.invoice_id::text = c.invoice_id
      union all
      select e.invoice_id, e.unit_kind, e.transaction_number, e.invoice_number, e.source_partner_id,
             coalesce(g.merged_partner_id, e.source_partner_id), g.merged_by,
             e.created_on, e.revenue, null::numeric, null::numeric, null::text, null::text[],
             'manual', false, null::numeric, null::numeric,
             false, e.excluded_by, e.excluded_reason, e.excluded_row_level, null::text
      from manual_excluded e
      left join manual_merge g on g.invoice_id::text = e.invoice_id
    ),
    manual_invoices as (
      select distinct on (v ->> 'invoice_id')
             (v ->> 'invoice_id') as invoice_id, (v ->> 'invoice_number') as invoice_number,
             (v ->> 'kind') as kind,
             coalesce(g.merged_partner_id, (v ->> 'partner_id')::uuid) as partner_id,
             (v ->> 'total_sar')::numeric as total_sar, (v ->> 'received_sar')::numeric as received_sar,
             (v ->> 'remaining_sar')::numeric as remaining_sar, (v ->> 'dpin') as dpin,
             (select pg_catalog.array_agg(x) from pg_catalog.jsonb_array_elements_text(v -> 'transactions') x) as transactions
      from pg_catalog.jsonb_array_elements(m_invoices) v
      left join manual_merge g on g.invoice_id::text = (v ->> 'invoice_id')
      order by v ->> 'invoice_id'
    ),
    -- Imported money rows: fully paid, a rule's hidden rows left out, the filters asked for. The organisation
    -- filter is on the organisation the row COUNTS under; the client filter on the one it is recorded under.
    import_base as (
      select r.id, r.partner_id as source_partner_id, r.eff_partner_id as partner_id, r.merged_by,
             r.mapped_kind, r.transaction_ref, r.invoice_ref, r.tax_no, r.record_date, r.amount_sar,
             r.revenue_sar, r.cost_sar, r.profit_sar, r.promo_discount_sar, r.source_promo,
             r.attribution_promo, r.promo_pool, r.excluded_by, r.excluded_reason, r.excluded_row_level,
             c.code_state,
             (select pg_catalog.array_agg(f) from pg_catalog.unnest(array[
                case when r.missing_transaction then 'missing_transaction' end,
                case when r.missing_invoice then 'missing_invoice' end,
                case when r.cost_pending then 'cost_pending' end,
                case when r.provisional then 'waiting_for_issuing' end,
                case when c.code_state = 'not_found' then 'code_not_found' end,
                case when c.code_state = 'ambiguous' then 'code_held' end
              ]) f where f is not null) as flags
      from finance.import_unit r
      join work.import_record c on c.id = r.id
      where r.fully_paid
        and r.excluded_mode is distinct from 'hide'
        and r.record_date between p_from and p_to
        and (p_partner is null or r.eff_partner_id = p_partner)
        and (client_key is null or exists (select 1 from partner.identifier d where d.deleted_at is null
             and d.kind = 'payments_client_id' and d.value_key = client_key and d.partner_id = r.partner_id))
        and (p_kind is null
             or (p_kind = 'transaction' and r.mapped_kind = 'transaction')
             or (p_kind = 'standalone' and r.mapped_kind = 'standalone'))
    ),
    import_rows as (
      select * from import_base where not code_view and not promo_pool
      union all
      select * from import_base
      where code_view and (source_promo = p_code or norm.code_key(source_promo) = wanted_code)
    ),
    combined_rows as (
      select invoice_id, unit_kind, transaction_number, invoice_number, source_partner_id, partner_id, merged_by,
             created_on, revenue, cost, profit, dpin, flags, source, is_promo, discount_sar, amount_sar,
             counted, excluded_by, not_counted_reason, excluded_row_level, code_state
      from manual_rows
      where p_partner is null or partner_id = p_partner
      union all
      select 'import:' || coalesce(invoice_ref, transaction_ref, id::text), mapped_kind, transaction_ref,
             invoice_ref, source_partner_id, partner_id, merged_by, record_date,
             revenue_sar,
             case when excluded_by is null then cost_sar end, case when excluded_by is null then profit_sar end,
             tax_no, flags, 'import'::text, attribution_promo, promo_discount_sar, amount_sar,
             excluded_by is null, excluded_by, excluded_reason, excluded_row_level, code_state
      from import_rows
    ),
    -- (d) one row per document across the two stores: organisation recorded under + kind + number, the row
    -- recorded here first (L18). Two documents that only share a number are two rows (FND-09).
    deduped as (
      select distinct on (source_partner_id, unit_kind, coalesce(transaction_number, invoice_number))
             *
      from combined_rows
      order by source_partner_id, unit_kind, coalesce(transaction_number, invoice_number) nulls last,
               case when source = 'manual' then 0 else 1 end, invoice_id
    ),
    counted_rows as (select * from deduped where counted),
    promo_rows as (
      select r.id, r.partner_id, r.transaction_ref, r.invoice_ref, r.record_date,
             r.source_promo as code, r.promo_discount_sar as discount_sar,
             r.revenue_sar as revenue, r.cost_sar as cost, r.profit_sar as profit,
             r.fully_paid as counted, r.direct_url, r.code_state
      from work.import_record r
      where r.deleted_at is null and not code_view
        and (r.attribution_promo or r.kind = 'promo')
        -- a code merged into an organisation has left the pool
        and not exists (select 1 from finance.merge_rule m where m.deleted_at is null and m.kind = 'discount_code'
                        and r.source_promo is not null and m.value_key = norm.code_key(r.source_promo))
        and r.record_date between p_from and p_to
        and (p_partner is null or r.partner_id = p_partner)
        and (client_key is null or exists (select 1 from partner.identifier d where d.deleted_at is null
             and d.kind = 'payments_client_id' and d.value_key = client_key and d.partner_id = r.partner_id))
    ),
    -- Invoices of the counted imported rows (never of every imported row): the invoice amount itself; a fully
    -- paid invoice has all of it received and nothing remaining.
    import_invoices as (
      select 'import:' || invoice_number as invoice_id, invoice_number,
             pg_catalog.min(unit_kind) as kind, partner_id,
             coalesce(pg_catalog.max(case when transaction_number is null then amount_sar end),
                      pg_catalog.sum(amount_sar)) as total_sar,
             coalesce(pg_catalog.max(case when transaction_number is null then amount_sar end),
                      pg_catalog.sum(amount_sar)) as received_sar,
             0::numeric as remaining_sar, pg_catalog.max(dpin) as dpin,
             coalesce(pg_catalog.array_agg(transaction_number) filter (where transaction_number is not null), '{}') as transactions
      from counted_rows
      where source = 'import' and invoice_number is not null
      group by partner_id, invoice_number
    ),
    invoices as (
      select * from manual_invoices where p_partner is null or partner_id = p_partner
      union all
      select * from import_invoices
    ),
    by_inv as (
      select partner_id, pg_catalog.sum(received_sar) as received, pg_catalog.sum(remaining_sar) as remaining
      from invoices group by partner_id
    ),
    -- A5: cost and profit are the sum over the rows that HAVE one — empty when none has, never 0.
    by_row as (
      select partner_id, pg_catalog.count(*)::int as units,
             coalesce(pg_catalog.sum(revenue), 0) as revenue,
             pg_catalog.sum(cost) filter (where cost is not null) as cost,
             pg_catalog.sum(profit) filter (where profit is not null) as profit,
             pg_catalog.count(*) filter (where cost is null)::int as without_cost
      from counted_rows group by partner_id
    ),
    by_company as (
      select coalesce(r.partner_id, v.partner_id) as partner_id, coalesce(r.units, 0) as units,
             coalesce(r.revenue, 0) as revenue, r.cost, r.profit, coalesce(r.without_cost, 0) as without_cost,
             coalesce(v.received, 0) as received, coalesce(v.remaining, 0) as remaining
      from by_row r
      full join by_inv v on coalesce(v.partner_id, '00000000-0000-0000-0000-000000000000'::uuid)
                          = coalesce(r.partner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ),
    companies as (
      select c.partner_id, p.number as partner_number, p.trade_name_en, p.trade_name_ar, c.units
      from (select partner_id, pg_catalog.count(*)::int as units from deduped group by partner_id) c
      left join partner.partner p on p.id = c.partner_id
    ),
    unconfirmed as (
      select pg_catalog.count(*)::int as units
      from work.import_record r
      where r.deleted_at is null and r.kind in ('transaction', 'invoice') and not r.fully_paid
        and r.record_date between p_from and p_to
        and (p_partner is null or r.partner_id = p_partner)
    ),
    -- A4: the code's discount inside the view asked for — the same dates, organisation and client as the rows.
    code_discount as (
      select case when not code_view then null else
        coalesce((
          select pg_catalog.sum(u.discount_sar) from finance.code_use u
          join partner.identifier d on d.id = u.code_id and d.deleted_at is null
          where u.deleted_at is null and d.value_raw = p_code
            and exists (
              select 1 from finance.money_row m
              join finance.invoice i on i.id = m.invoice_id
              left join manual_merge g on g.invoice_id = m.invoice_id
              where m.invoice_id = u.invoice_id and m.counted
                and m.created_on between p_from and p_to
                and (p_partner is null or coalesce(g.merged_partner_id, m.partner_id) = p_partner)
                and (client_key is null or i.client_id_key = client_key
                     or exists (select 1 from partner.identifier c where c.deleted_at is null
                                and c.kind = 'payments_client_id' and c.value_key = client_key
                                and c.partner_id = m.partner_id)))), 0)
        + coalesce((
          select pg_catalog.sum(x.discount_sar) from (
            select distinct on (r.partner_id, r.invoice_ref) r.invoice_ref, r.promo_discount_sar as discount_sar
            from finance.import_unit r
            where r.fully_paid and r.excluded_by is null and r.promo_discount_sar is not null
              and (r.source_promo = p_code or norm.code_key(r.source_promo) = wanted_code)
              and r.record_date between p_from and p_to
              and (p_partner is null or r.eff_partner_id = p_partner)
              and (client_key is null or exists (select 1 from partner.identifier d where d.deleted_at is null
                   and d.kind = 'payments_client_id' and d.value_key = client_key and d.partner_id = r.partner_id))
            order by r.partner_id, r.invoice_ref, r.record_date desc nulls last) x), 0)
      end as discount
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'partner', p_partner, 'client_id', p_client_id, 'kind', p_kind, 'code', p_code,
      'project', (manual ->> 'project'),
      'can_toggle', authz.is_admin(),
      'totals', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from counted_rows),
        'revenue', (select coalesce(pg_catalog.sum(revenue), 0) from counted_rows),
        'cost', (select pg_catalog.sum(cost) filter (where cost is not null) from counted_rows),
        'profit', (select pg_catalog.sum(profit) filter (where profit is not null) from counted_rows),
        'without_cost', (select pg_catalog.count(*) from counted_rows where cost is null),
        'received', (select coalesce(pg_catalog.sum(received_sar), 0) from invoices),
        'remaining', (select coalesce(pg_catalog.sum(remaining_sar), 0) from invoices),
        'manual_units', (select pg_catalog.count(*) from counted_rows where source = 'manual'),
        'import_units', (select pg_catalog.count(*) from counted_rows where source = 'import'),
        'promo_units', (select pg_catalog.count(*) from promo_rows),
        'unconfirmed_import_units', (select units from unconfirmed),
        'excluded_units', (select pg_catalog.count(*) from deduped where not counted),
        'excluded_revenue', (select coalesce(pg_catalog.sum(revenue), 0) from deduped where not counted)),
      'companies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.trade_name_en nulls last)
                             from companies c), '[]'::jsonb),
      'by_company', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) order by b.partner_id nulls last)
                              from by_company b), '[]'::jsonb),
      'invoices', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) order by v.invoice_number nulls last)
                            from invoices v), '[]'::jsonb),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'invoice_id', r.invoice_id, 'unit_kind', r.unit_kind, 'transaction_number', r.transaction_number,
          'invoice_number', r.invoice_number, 'partner_id', r.partner_id,
          'source_partner_id', r.source_partner_id, 'merged_by', r.merged_by,
          'number', coalesce(r.transaction_number, r.invoice_number),
          'created_on', r.created_on,
          'revenue', r.revenue, 'cost', r.cost, 'profit', r.profit, 'dpin', r.dpin,
          'flags', coalesce(pg_catalog.to_jsonb(r.flags), '[]'::jsonb),
          'source', r.source, 'is_promo', r.is_promo, 'discount_sar', r.discount_sar,
          'counted', r.counted, 'excluded_by', r.excluded_by, 'not_counted_reason', r.not_counted_reason,
          'excluded_row_level', r.excluded_row_level, 'code_state', r.code_state)
          order by r.created_on desc nulls last, r.transaction_number nulls last)
                        from (select * from deduped order by created_on desc nulls last, transaction_number nulls last limit 1000) r), '[]'::jsonb),
      'truncated', (select m_truncated or (select pg_catalog.count(*) from deduped) > 1000),
      'promo_rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(pr) order by pr.record_date desc nulls last)
                              from promo_rows pr), '[]'::jsonb),
      'code_discount', (select discount from code_discount)
    )
  );
end
$$;
-- CREATE OR REPLACE drops a function's settings: the Ledger keeps jit = off (L27, JIT-03).
alter function finance.unified_ledger(date, date, uuid, text, text, text, text) set jit = off;
comment on function finance.unified_ledger(date, date, uuid, text, text, text, text) is
  'The unified Ledger: rows recorded here plus imported rows, one per document. Since Landing 32 every row says whether it counts (and why not), the exclusion and merge lists are applied to both stores, an unknown cost is empty, and a code view''s discount respects the dates and the organisation asked for.';

-- ================================================================ the code detail carries what the toggle needs
-- The same read (20261113120001) with, per use: the organisation and number Exclude / Include takes, the kind
-- of rule that excludes it, and whether that was by hand; and can_toggle for the reader. Nothing else changes.
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
    -- Landing 32: whether the reader may Exclude / Include a use's row (admins)
    'can_toggle', authz.is_admin(),
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
        -- Landing 32: a unit whose cost is not known yet (provisional) has no cost — empty, never 0
        select sum(m.cost) filter (where not m.provisional) from finance.code_use u
        join finance.money_row m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_profit', (
        select sum(m.profit) filter (where not m.provisional) from finance.code_use u
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
               (select sum(m.cost) filter (where not m.provisional) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as cost,
               (select sum(m.profit) filter (where not m.provisional) from finance.money_row m where m.invoice_id = u.invoice_id and m.counted) as profit,
               (select min(m.excluded_reason) from finance.money_row m where m.invoice_id = u.invoice_id) as excluded_reason,
               -- Landing 32: what Exclude / Include takes — the organisation the invoice is recorded under and its
               -- own number — and whether it is excluded by hand (Include undoes that) or by a list rule
               (select m.partner_id from finance.money_row m where m.invoice_id = u.invoice_id limit 1) as partner_id,
               i.ref as number,
               (select min(m.excluded_by) from finance.money_row m where m.invoice_id = u.invoice_id) as excluded_by,
               coalesce((select x.partner_id is not null from finance.exclusion_of(u.invoice_id) x where x.id is not null), false)
                 as excluded_row_level
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
-- CREATE OR REPLACE drops a function's settings: the codes reads keep jit = off (L28, JIT-05).
alter function finance.codes_detail(uuid) set jit = off;

-- ================================================================ the organisation's "not yet counted" card
-- It counted the excluded rows recorded here only; an excluded IMPORTED row was listed on the tab and missing
-- from this card. Now both stores (the organisation the row counts under), one document once. Held rows are
-- unchanged (recorded here, not excluded, not counted).
create or replace function finance.company_not_counted(p_partner uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_partner is null or p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with imp as (
      select i.revenue_sar from finance.import_unit i
      where i.eff_partner_id = p_partner and i.fully_paid and i.excluded_mode = 'exclude'
        and i.record_date between p_from and p_to
        and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = i.partner_id and m.unit_kind = i.mapped_kind and m.ref = i.number)
    )
    select pg_catalog.jsonb_build_object(
      'excluded_units', pg_catalog.count(*) filter (where r.excluded_by is not null) + (select pg_catalog.count(*) from imp),
      'excluded_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is not null), 0)
                          + coalesce((select pg_catalog.sum(revenue_sar) from imp), 0),
      'held_units', pg_catalog.count(*) filter (where r.excluded_by is null and not r.counted),
      'held_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is null and not r.counted), 0))
    from finance.money_row r
    where r.partner_id = p_partner
      and r.created_on between p_from and p_to
  );
end
$$;
alter function finance.company_not_counted(uuid, date, date) set jit = off;
