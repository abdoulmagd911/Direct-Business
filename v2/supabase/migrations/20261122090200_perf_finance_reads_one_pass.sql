-- Landing 35 — each Finance read works the money rows out once (owner's live sweep, 21 Nov 2026).
--
-- After 20261122090100 a mention of finance.money_row costs one working-out of the rows. These reads still
-- mentioned it two to four times in one statement (the period figures, the months, the not-yet-counted gap, the
-- two codes lists, a code's detail (twelve times), the organisation summary — which also read finance.invoice_fact twice — and Income by
-- service, which read finance.money_service_row in two statements, each mentioning the rows twice). Each now
-- takes the rows once, in a `mr` (and `fact`) list at the top of its statement, and reads that list wherever it
-- mentioned the view. Nothing else in these bodies changes: the same filters, sums and JSON, word for word, so
-- the same answers. Every function keeps its settings: search_path in its definition, and jit off put back by
-- an ALTER after it (CREATE OR REPLACE drops it; JIT-01..05 pin it, and their sabotages take these lines away).
-- No signature or grant changes, so database.types.ts and grants.expected are unchanged.

-- The Ledger of the rows recorded here, worked out from money rows it is HANDED (finance.ledger's statement,
-- unchanged, reading the list instead of the view). finance.ledger hands it the money rows; the unified Ledger
-- takes the rows once and hands the same list to every part it needs — it used to work them out again for
-- its own excluded rows and once more per merge rule of the organisation. Internal: it asks nobody, so no
-- request role may call it (GRANTS-04); the two callers ask first.
create function finance.ledger_calc(p_rows finance.money_row[], p_from date, p_to date, p_partner uuid, p_client_id text, p_kind text, p_code text, p_project text)
 returns jsonb
 language plpgsql
 stable
 set search_path to ''
 set jit to 'off'
as $function$
declare
  client_key text := case when pg_catalog.btrim(coalesce(p_client_id, '')) = '' then null
                          else norm.digits_key(p_client_id, true) end;
  wanted_code text := case when pg_catalog.btrim(coalesce(p_code, '')) = '' then null
                         else norm.code_key(p_code) end;
  -- p_project is reserved (see the header): read so the argument is part of the call, matched by nothing yet.
  project_filter text := case when pg_catalog.btrim(coalesce(p_project, '')) = '' then null else p_project end;
begin
  return (
    with rec as (
      select invoice_id, coalesce(sum(amount_sar), 0) as received
      from finance.receipt where deleted_at is null group by invoice_id
    ),
    -- Every revenue unit in the period, before the company filter: the company dropdown lists these, so picking
    -- a company never empties its own list. Counted is the fully-paid gate now (part b); the duplicate gated
    -- test that used to live here is gone.
    base as (
      select r.invoice_id, r.unit_kind, r.ref, r.partner_id, r.created_on, r.month_on, r.revenue,
             i.kind as invoice_kind, i.total_sar, i.figure_state,
             norm.fold(i.status_raw) as status_word, sm.maps_to as status_maps_to,
             bl.billing_invoice_id, bi.ref as billing_ref, bi.total_sar as billing_total,
             norm.fold(bi.status_raw) as billing_word, bsm.maps_to as billing_maps_to,
             coalesce(ti.dpin, tbi.dpin) as dpin,
             coalesce(ur.received, 0) as unit_received, coalesce(br.received, 0) as bill_received,
             c.cost_sar, c.approved_count, c.cost_basis, c.cost_status
      from pg_catalog.unnest(p_rows) r
      join finance.invoice i on i.id = r.invoice_id
      left join finance.status_map sm on sm.id = i.status_id
      left join finance.billing_link bl on bl.transaction_invoice_id = r.invoice_id and bl.deleted_at is null
      left join finance.invoice bi on bi.id = bl.billing_invoice_id
      left join finance.status_map bsm on bsm.id = bi.status_id
      left join finance.tax_invoice ti on ti.parent_invoice_id = r.invoice_id and ti.deleted_at is null
      left join finance.tax_invoice tbi on tbi.parent_invoice_id = bl.billing_invoice_id and tbi.deleted_at is null
      left join rec ur on ur.invoice_id = r.invoice_id
      left join rec br on br.invoice_id = bl.billing_invoice_id
      left join finance.invoice_cost c on c.id = r.invoice_id
      where r.excluded_by is null
        and r.counted
        and r.created_on between p_from and p_to
        and (client_key is null or i.client_id_key = client_key
             or exists (select 1 from partner.identifier d where d.deleted_at is null
                        and d.kind = 'payments_client_id' and d.value_key = client_key
                        and d.partner_id = r.partner_id))
        and (wanted_code is null or i.code_key = wanted_code)
        and (p_kind is null
             or (p_kind = 'transaction' and r.unit_kind = 'transaction')
             or (p_kind = 'standalone' and r.unit_kind = 'standalone')
             or (p_kind = 'billing' and (bl.billing_invoice_id is not null or r.unit_kind = 'monthly_fee')))
        -- credit_note and wallet_topup are never revenue units, so they honestly answer no rows.
    ),
    -- The cost a row carries: a monthly fee and a no-supplier-cost unit carry 0; a provisional unit carries
    -- nothing (empty, never its approved-so-far cost — part c, rulebook §16); otherwise its approved cost.
    gated as (
      select b.*,
             case when b.unit_kind = 'monthly_fee' then 0
                  when b.cost_basis = 'no_supplier_cost' then 0
                  when b.cost_status = 'provisional' then null
                  when coalesce(b.approved_count, 0) > 0 then b.cost_sar end as cost_out
      from base b
    ),
    -- The filtered view: the company filter applies here, after the dropdown's list was taken from `gated`.
    rows as (
      select g.*,
             case when g.unit_kind in ('transaction', 'standalone') then g.ref end as transaction_number,
             case when g.billing_invoice_id is not null then g.billing_ref
                  when g.unit_kind in ('standalone', 'monthly_fee') then g.ref end as invoice_number,
             -- A monthly fee's money_row id IS its monthly invoice, so it collects onto itself, not onto null.
             case when g.unit_kind = 'monthly_fee' then g.invoice_id
                  when g.billing_invoice_id is not null then g.billing_invoice_id
                  else g.invoice_id end as collectable_id,
             case when g.unit_kind = 'monthly_fee' then g.ref
                  when g.billing_invoice_id is not null then g.billing_ref
                  when g.unit_kind = 'standalone' then g.ref end as collectable_ref,
             case when g.unit_kind = 'monthly_fee' then 'billing'
                  when g.billing_invoice_id is not null then 'billing'
                  else g.unit_kind end as collectable_kind,
             case when g.unit_kind = 'monthly_fee' then g.total_sar
                  when g.billing_invoice_id is not null then g.billing_total else g.total_sar end as collectable_total,
             case when g.unit_kind = 'monthly_fee' then g.unit_received
                  when g.billing_invoice_id is not null then g.bill_received else g.unit_received end as collectable_received,
             (select array_agg(f) from unnest(array[
                case when g.billing_invoice_id is null and g.unit_kind = 'transaction'
                     then 'no_invoice_yet' end,
                case when g.unit_kind = 'monthly_fee' then 'monthly_fee' end,
                case when g.unit_kind <> 'monthly_fee' and g.cost_basis <> 'no_supplier_cost'
                          and coalesce(g.approved_count, 0) = 0 then 'cost_pending' end,
                case when g.dpin is null then 'waiting_for_issuing' end
              ]) f where f is not null) as flags
      from gated g
      where p_partner is null or g.partner_id = p_partner
    ),
    -- One row per invoice that owns a listed unit: its total, what arrived, what is left. Receipts sit on the
    -- monthly invoice, so a gathered transaction's received and remaining live here, not on its own row.
    invoices as (
      select collectable_id as invoice_id, collectable_ref as invoice_number, collectable_kind as kind,
             partner_id, min(collectable_total) as total_sar, min(collectable_received) as received_sar,
             min(collectable_total) - min(collectable_received) as remaining_sar,
             min(dpin) as dpin,
             coalesce(array_agg(transaction_number) filter (where transaction_number is not null), '{}') as transactions
      from rows
      where collectable_id is not null
      group by collectable_id, collectable_ref, collectable_kind, partner_id
    ),
    companies as (
      select partner_id, p.number as partner_number, p.trade_name_en, p.trade_name_ar,
             count(*)::int as units
      from gated g left join partner.partner p on p.id = g.partner_id
      group by partner_id, p.number, p.trade_name_en, p.trade_name_ar
    ),
    -- By company, kept as two plain aggregates joined together: received and remaining come from the invoices,
    -- revenue, cost and profit from the unit rows, so a gathered transaction's receipts are never counted twice.
    by_inv as (
      select partner_id, sum(received_sar) as received, sum(remaining_sar) as remaining
      from invoices group by partner_id
    ),
    by_row as (
      select partner_id, count(*)::int as units, coalesce(sum(revenue), 0) as revenue,
             coalesce(sum(cost_out) filter (where cost_out is not null), 0) as cost,
             coalesce(sum(revenue - cost_out) filter (where cost_out is not null), 0) as profit,
             count(*) filter (where cost_out is null)::int as without_cost
      from rows group by partner_id
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'partner', p_partner, 'client_id', p_client_id, 'kind', p_kind, 'code', p_code,
      'project', project_filter,
      'totals', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from rows),
        'revenue', (select coalesce(sum(revenue), 0) from rows),
        'cost', (select coalesce(sum(cost_out), 0) from rows where cost_out is not null),
        'profit', (select coalesce(sum(revenue - cost_out), 0) from rows where cost_out is not null),
        'without_cost', (select pg_catalog.count(*) from rows where cost_out is null),
        'received', (select coalesce(sum(received_sar), 0) from invoices),
        'remaining', (select coalesce(sum(remaining_sar), 0) from invoices)),
      'companies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.trade_name_en nulls last)
                             from companies c), '[]'::jsonb),
      'by_company', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'partner_id', coalesce(r.partner_id, v.partner_id), 'units', coalesce(r.units, 0),
          'revenue', coalesce(r.revenue, 0), 'cost', coalesce(r.cost, 0), 'profit', coalesce(r.profit, 0),
          'without_cost', coalesce(r.without_cost, 0),
          'received', coalesce(v.received, 0), 'remaining', coalesce(v.remaining, 0))
          order by coalesce(r.partner_id, v.partner_id) nulls last)
        from by_row r full join by_inv v on coalesce(v.partner_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(r.partner_id, '00000000-0000-0000-0000-000000000000'::uuid)), '[]'::jsonb),
      'invoices', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v) order by v.invoice_number nulls last)
                            from invoices v), '[]'::jsonb),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'invoice_id', invoice_id, 'unit_kind', unit_kind, 'transaction_number', transaction_number,
          'invoice_number', invoice_number, 'partner_id', partner_id, 'created_on', created_on,
          'revenue', revenue, 'cost', cost_out,
          'profit', case when cost_out is null then null else revenue - cost_out end,
          'dpin', dpin, 'flags', coalesce(pg_catalog.to_jsonb(flags), '[]'::jsonb))
          order by created_on desc, transaction_number nulls last)
        from (select * from rows order by created_on desc, transaction_number nulls last limit 1000) capped),
        '[]'::jsonb),
      'truncated', (select pg_catalog.count(*) > 1000 from rows)
    )
  );
end
$function$;

CREATE OR REPLACE FUNCTION finance.ledger(p_from date, p_to date, p_partner uuid DEFAULT NULL::uuid, p_client_id text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_project text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  if p_kind is not null and p_kind not in ('transaction', 'standalone', 'billing', 'credit_note', 'wallet_topup') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end if;

  return finance.ledger_calc(array(select m from finance.money_row m), p_from, p_to, p_partner, p_client_id, p_kind,
                             p_code, p_project);
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.ledger(date, date, uuid, text, text, text, text) set jit = off;

CREATE OR REPLACE FUNCTION finance.unified_ledger(p_from date, p_to date, p_partner uuid DEFAULT NULL::uuid, p_client_id text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_project text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  mrows finance.money_row[];
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
  -- the money rows, worked out once for everything below
  mrows := array(select m from finance.money_row m);
  manual := finance.ledger_calc(mrows, p_from, p_to, p_partner, p_client_id, p_kind, p_code, p_project);
  m_rows := coalesce(manual -> 'rows', '[]'::jsonb);
  m_invoices := coalesce(manual -> 'invoices', '[]'::jsonb);
  m_truncated := coalesce((manual ->> 'truncated')::boolean, false);
  -- the rows recorded here that the merge list brings INTO the organisation asked for
  if p_partner is not null then
    for rule in select m.kind, m.value_raw from finance.merge_rule m
                where m.deleted_at is null and m.partner_id = p_partner loop
      if rule.kind = 'client_id' and client_key is null then
        extra := finance.ledger_calc(mrows, p_from, p_to, null, rule.value_raw, p_kind, p_code, p_project);
      elsif rule.kind = 'discount_code' and not code_view then
        extra := finance.ledger_calc(mrows, p_from, p_to, null, null, p_kind, rule.value_raw, p_project);
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
      from pg_catalog.unnest(mrows) r
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
              select 1 from pg_catalog.unnest(mrows) m
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
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.unified_ledger(date, date, uuid, text, text, text, text) set jit = off;

CREATE OR REPLACE FUNCTION finance.period_figures(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with mr as materialized (select m.* from finance.money_row m),
    import_base as (
      select r.id, r.record_date, r.revenue_sar, r.cost_sar, r.profit_sar
      from finance.import_unit r
      where r.fully_paid and r.excluded_by is null and not r.promo_pool
        and r.record_date between p_from and p_to
        and not exists (select 1 from mr m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = r.partner_id and m.unit_kind = r.mapped_kind and m.ref = r.number)
    ),
    r as (
      select x.month_on, x.revenue, x.cost, x.profit, x.provisional, x.loss, x.estimate
      from mr x where x.counted and x.created_on between p_from and p_to
      union all
      select pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
             i.revenue_sar as revenue, i.cost_sar as cost, i.profit_sar as profit,
             (i.cost_sar is null) as provisional, (i.profit_sar < 0) as loss, null::numeric as estimate
      from import_base i
    ),
    months as (
      select r.month_on, count(*)::int as units, sum(r.revenue) as revenue,
             coalesce(sum(r.cost) filter (where not r.provisional), 0) as cost,
             coalesce(sum(r.profit) filter (where not r.provisional), 0) as profit,
             count(*) filter (where r.provisional)::int as provisional_units,
             coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
             coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
             count(*) filter (where r.loss)::int as losses
      from r group by r.month_on
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'units', (select pg_catalog.count(*) from r),
      'revenue', (select coalesce(sum(r.revenue), 0) from r),
      'cost', (select coalesce(sum(r.cost) filter (where not r.provisional), 0) from r),
      'profit', (select coalesce(sum(r.profit) filter (where not r.provisional), 0) from r),
      'provisional', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from r where r.provisional),
        'revenue', (select coalesce(sum(r.revenue), 0) from r where r.provisional),
        'cost', (select case when pg_catalog.count(*) filter (where r.provisional) = 0 then 0::numeric
                             else null::numeric end from r),
        'profit', (select coalesce(sum(r.profit), 0) from r where r.provisional)),
      'losses', (select pg_catalog.count(*) from r where r.loss),
      'estimate', (select sum(r.estimate) from r where r.estimate is not null),
      'estimated_units', (select pg_catalog.count(*) from r where r.estimate is not null),
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on)
                          from months m), '[]'::jsonb))
  );
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.period_figures(date, date) set jit = off;

CREATE OR REPLACE FUNCTION finance.counted_by_month(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with mr as materialized (select m.* from finance.money_row m),
    u as (
      select m.month_on, m.revenue,
             case when m.counted then 'counted' when m.excluded_by is not null then 'excluded' else 'not_paid' end as state
      from mr m
      where m.created_on between p_from and p_to
      union all
      select pg_catalog.date_trunc('month', i.record_date::timestamp)::date, i.revenue_sar,
             case when i.excluded_by is not null then 'excluded'
                  when not i.fully_paid then 'not_paid'
                  when i.promo_pool then 'promo_pool'
                  else 'counted' end
      from finance.import_unit i
      where i.record_date between p_from and p_to
        and i.excluded_mode is distinct from 'hide'
        and not exists (select 1 from mr m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = i.partner_id and m.unit_kind = i.mapped_kind and m.ref = i.number)
    ),
    months as (
      select u.month_on,
             pg_catalog.count(*) filter (where u.state = 'counted')::int as counted_units,
             coalesce(sum(u.revenue) filter (where u.state = 'counted'), 0) as counted_revenue,
             pg_catalog.count(*) filter (where u.state <> 'counted')::int as not_counted_units,
             coalesce(sum(u.revenue) filter (where u.state <> 'counted'), 0) as not_counted_revenue,
             pg_catalog.count(*) filter (where u.state = 'excluded')::int as excluded_units,
             coalesce(sum(u.revenue) filter (where u.state = 'excluded'), 0) as excluded_revenue,
             pg_catalog.count(*) filter (where u.state = 'not_paid')::int as not_paid_units,
             coalesce(sum(u.revenue) filter (where u.state = 'not_paid'), 0) as not_paid_revenue,
             pg_catalog.count(*) filter (where u.state = 'promo_pool')::int as promo_pool_units,
             coalesce(sum(u.revenue) filter (where u.state = 'promo_pool'), 0) as promo_pool_revenue
      from u where u.month_on is not null group by u.month_on
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on) from months m), '[]'::jsonb),
      'years', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(y) order by y.year) from (
        select pg_catalog.date_part('year', m.month_on)::int as year,
               sum(m.counted_units)::int as counted_units, sum(m.counted_revenue) as counted_revenue,
               sum(m.not_counted_units)::int as not_counted_units, sum(m.not_counted_revenue) as not_counted_revenue,
               sum(m.excluded_units)::int as excluded_units, sum(m.excluded_revenue) as excluded_revenue,
               sum(m.not_paid_units)::int as not_paid_units, sum(m.not_paid_revenue) as not_paid_revenue,
               sum(m.promo_pool_units)::int as promo_pool_units, sum(m.promo_pool_revenue) as promo_pool_revenue
        from months m group by 1) y), '[]'::jsonb))
  );
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.counted_by_month(date, date) set jit = off;

CREATE OR REPLACE FUNCTION finance.company_not_counted(p_partner uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'view');
  if p_partner is null or p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with mr as materialized (select m.* from finance.money_row m),
    imp as (
      select i.revenue_sar from finance.import_unit i
      where i.eff_partner_id = p_partner and i.fully_paid and i.excluded_mode = 'exclude'
        and i.record_date between p_from and p_to
        and not exists (select 1 from mr m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = i.partner_id and m.unit_kind = i.mapped_kind and m.ref = i.number)
    )
    select pg_catalog.jsonb_build_object(
      'excluded_units', pg_catalog.count(*) filter (where r.excluded_by is not null) + (select pg_catalog.count(*) from imp),
      'excluded_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is not null), 0)
                          + coalesce((select pg_catalog.sum(revenue_sar) from imp), 0),
      'held_units', pg_catalog.count(*) filter (where r.excluded_by is null and not r.counted),
      'held_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is null and not r.counted), 0))
    from mr r
    where r.partner_id = p_partner
      and r.created_on between p_from and p_to
  );
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.company_not_counted(uuid, date, date) set jit = off;

CREATE OR REPLACE FUNCTION finance.codes_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('codes', 'view');
  return coalesce((with mr as materialized (select m.* from finance.money_row m)
    select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.total_discount desc nulls last, r.code)
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
          and exists (select 1 from mr m where m.invoice_id = u.invoice_id and m.counted)
      ) disc on true
      left join lateral (
        select sum(m.revenue) as total_collected, pg_catalog.count(*)::int as units
        from finance.code_use u
        join mr m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = d.id and u.deleted_at is null
      ) money on true
      where d.kind = 'discount_code' and d.deleted_at is null
    ) r), '[]'::jsonb);
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.codes_list() set jit = off;

CREATE OR REPLACE FUNCTION finance.codes_by_company()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('codes', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r) order by r.total_discount desc nulls last, r.partner_name)
    from (
      with mr as materialized (select m.* from finance.money_row m),
      per_code as (
        select u.code_id,
               (select sum(u2.discount_sar) from finance.code_use u2
                where u2.code_id = u.code_id and u2.deleted_at is null
                  and exists (select 1 from mr m2 where m2.invoice_id = u2.invoice_id and m2.counted)
               ) as total_discount,
               sum(m.revenue) as total_collected,
               sum(m.profit) as total_profit
        from finance.code_use u
        join mr m on m.invoice_id = u.invoice_id and m.counted
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
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.codes_by_company() set jit = off;

CREATE OR REPLACE FUNCTION finance.codes_detail(p_code uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  return (
  with mr as materialized (select m.* from finance.money_row m)
  select pg_catalog.jsonb_build_object(
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
          and exists (select 1 from mr m where m.invoice_id = u.invoice_id and m.counted)),
      'total_collected', (
        select sum(m.revenue) from finance.code_use u
        join mr m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_cost', (
        -- Landing 32: a unit whose cost is not known yet (provisional) has no cost — empty, never 0
        select sum(m.cost) filter (where not m.provisional) from finance.code_use u
        join mr m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'total_profit', (
        select sum(m.profit) filter (where not m.provisional) from finance.code_use u
        join mr m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null),
      'units', (
        select pg_catalog.count(*)::int from finance.code_use u
        join mr m on m.invoice_id = u.invoice_id and m.counted
        where u.code_id = code_row.id and u.deleted_at is null)),
    'ledger', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.counted desc, l.created_on)
      from (
        select u.id as use_id, u.invoice_id, u.invoice_ref as ref, i.created_on, i.status_raw as status_word,
               u.discount_sar, u.source, u.direct_url,
               (select coalesce(pg_catalog.bool_and(m.counted), false) from mr m where m.invoice_id = u.invoice_id) as counted,
               (select sum(m.revenue) from mr m where m.invoice_id = u.invoice_id and m.counted) as revenue,
               (select sum(m.cost) filter (where not m.provisional) from mr m where m.invoice_id = u.invoice_id and m.counted) as cost,
               (select sum(m.profit) filter (where not m.provisional) from mr m where m.invoice_id = u.invoice_id and m.counted) as profit,
               (select min(m.excluded_reason) from mr m where m.invoice_id = u.invoice_id) as excluded_reason,
               -- Landing 32: what Exclude / Include takes — the organisation the invoice is recorded under and its
               -- own number — and whether it is excluded by hand (Include undoes that) or by a list rule
               (select m.partner_id from mr m where m.invoice_id = u.invoice_id limit 1) as partner_id,
               i.ref as number,
               (select min(m.excluded_by) from mr m where m.invoice_id = u.invoice_id) as excluded_by,
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
      where a.code_id = code_row.id and a.deleted_at is null), '[]'::jsonb))
  );
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.codes_detail(uuid) set jit = off;

CREATE OR REPLACE FUNCTION partner.company_summary(p_partner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  finance_visible boolean;
  found boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select exists (select 1 from partner.partner p where p.id = p_partner and p.deleted_at is null) into found;
  if not found then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- The company page's own gate (partner.partner_get): a side at view on this company, not the blanket
  -- partners page level — the page opens for readers the blanket level refuses, and the money inside stays
  -- gated by finance_visible below.
  perform partner.require_level(p_partner, null, 'view');
  finance_visible := authz.level_of(me, 'finance') >= 'view';
  return (
  with mr as materialized (select m.* from finance.money_row m),
  fact as materialized (select f.* from finance.invoice_fact f)
  select pg_catalog.jsonb_build_object(
    'partner_id', p_partner,
    'finance_visible', finance_visible,
    'wallet', case when finance_visible then (
      select pg_catalog.jsonb_build_object(
        'topped_up', coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup'), 0),
        'wallet_spent', coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup'), 0),
        'invoiced_total', coalesce(sum(f.total_sar) filter (where f.kind <> 'wallet_topup'), 0),
        -- The wallet's own balance: paid top-ups less the wallet part of paid invoices (the existing
        -- finance.partner_wallet meaning). All invoice totals are shown apart, never mixed into it.
        'balance', coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup'), 0)
                   - coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup'), 0),
        -- No workspace table records a hold, so held — and available, which needs it — stay empty.
        'held', null,
        'available', null)
      from fact f where f.partner_id = p_partner and f.pay_state = 'paid') end,
    'finance', case when finance_visible then (
      select pg_catalog.jsonb_build_object(
        'units', pg_catalog.count(*) filter (where r.counted),
        'revenue', coalesce(sum(r.revenue) filter (where r.counted), 0),
        -- Missing cost stays empty, never 0: only approved (non-Provisional) cost is summed, and when
        -- every counted unit is still Provisional the sum is null. Profit needs cost, so it is empty too.
        'cost', sum(r.cost) filter (where r.counted and not r.provisional),
        'profit', case when sum(r.cost) filter (where r.counted and not r.provisional) is null then null
                        else coalesce(sum(r.revenue) filter (where r.counted), 0)
                             - sum(r.cost) filter (where r.counted and not r.provisional) end,
        'provisional_units', pg_catalog.count(*) filter (where r.counted and r.provisional),
        'provisional_revenue', coalesce(sum(r.revenue) filter (where r.counted and r.provisional), 0),
        -- Provisional, as two flags: cost still pending, and tax invoices still waiting to be issued
        -- (a counted unit whose invoice carries no DPIN yet). The row itself is kept either way.
        -- Fix23 (change #4): the old code answered each flag with its own correlated subquery that
        -- re-scanned money_row (and invoice_fact again for the waiting flags). The invoice_fact
        -- join is done once here, in the main FROM, and the flags are boolean aggregates over that
        -- single pass. bool_or over no counted rows is null, never false, so each flag is
        -- coalesced to false — the old exists(...) always returned true/false, and waiting_count
        -- was always a number (0 when empty), so the folded versions match on every input,
        -- including the empty case. f.id is not null keeps the old inner join's meaning: a
        -- snapshot-only unit whose invoice is gone did not count as waiting.
        'cost_pending',
        coalesce(pg_catalog.bool_or(r.provisional) filter (where r.counted), false),
        'waiting_for_issuing',
        coalesce(pg_catalog.bool_or(f.id is not null and f.dpin is null) filter (where r.counted), false),
        'waiting_count',
        pg_catalog.count(distinct r.invoice_id) filter (where r.counted and f.id is not null and f.dpin is null))
      from mr r
      left join fact f on f.id = r.invoice_id
      where r.partner_id = p_partner) end,
    'codes', case when finance_visible then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', g.code, 'units', g.units, 'revenue', g.revenue, 'profit', g.profit)
               order by g.revenue desc)
      -- Fix23 (change #3): the old code called finance.sales_by_code, which groups the whole
      -- counted coded population (all partners, all months) before the partner filter applies —
      -- at 5,001 invoice rows the single biggest execution node (~3.3 s inside the whole query).
      -- This is the same row definition sales_by_code uses (money_row joined to invoice where
      -- counted and code_key is not null; code = min(discount_code_raw); units = count,
      -- revenue = sum, profit = sum; the discount-code identifier and the campaign code joined
      -- for the label, with the validity window on the unit's created day), restricted to this
      -- partner's rows only and grouped by code text. The campaign join cannot change a figure:
      -- a campaign-held code has no partner, so it never passes the holder filter below, and the
      -- exclusion constraint on campaign_code means at most one campaign row can match a unit.
      -- The view's per-group fee_percent lookup is not reproduced: company_summary never showed it.
      from (select min(i.discount_code_raw) as code, pg_catalog.count(*)::int as units,
                   sum(r.revenue) as revenue, sum(r.profit) as profit
            from mr r
            join finance.invoice i on i.id = r.invoice_id
            left join partner.identifier d on d.kind = 'discount_code' and d.value_key = i.code_key
              and d.deleted_at is null
              and (d.valid_from is null or d.valid_from <= r.created_on)
              and (d.valid_to is null or r.created_on <= d.valid_to)
            left join partner.campaign_code c on c.code_key = i.code_key and c.deleted_at is null
              and (c.valid_from is null or c.valid_from <= r.created_on)
              and (c.valid_to is null or r.created_on <= c.valid_to)
            where r.counted and r.partner_id = p_partner and i.code_key is not null
              and d.partner_id = p_partner
            group by i.code_key) g), '[]'::jsonb) end,
    'tenders', case when finance_visible then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', u.tender_id, 'number', u.number, 'title', u.title,
               'state', case when u.signed_on is null then 'applied' else 'signed' end,
               'signed_on', u.signed_on, 'client_id_named', u.client_identifier_id is not null,
               'tender_amount', u.signed_value,
               'invoiced', case when u.signed_on is not null then u.consumed end,
               'remaining', case when u.signed_on is not null then greatest(u.signed_value - u.consumed, 0) end,
               'units', case when u.signed_on is not null then u.units end,
               -- Approved cost on the tender's own client ID; empty while every unit is Provisional.
               -- Fix23 (change #5): computed ONCE per tender in the lateral below and reused for
               -- approved_cost, cost_pending and actual_profit. The old code evaluated the same SUM
               -- three times per tender row (once directly, twice inside actual_profit's CASE).
               'approved_cost', a.approved_cost,
               'cost_pending', a.cost_pending,
               'actual_profit', case when u.signed_on is null then null
                 when a.approved_cost is null then null
                 else u.consumed - a.approved_cost end,
               -- No expected-cost field exists on a tender, so expected profit is never guessed.
               'expected_cost', null,
               'expected_profit', null)
               order by u.signed_on desc nulls last, u.number)
      from finance.tender_use u
      left join lateral (
        select sum(r.cost) filter (where not r.provisional) as approved_cost,
               coalesce(pg_catalog.bool_or(r.provisional), false) as cost_pending
        from mr r
        join finance.invoice i on i.id = r.invoice_id
        join partner.identifier d on d.id = u.client_identifier_id
          and d.deleted_at is null and d.value_key = i.client_id_key
        where r.counted
      ) a on true
      where u.partner_id = p_partner), '[]'::jsonb) end)
  );
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function partner.company_summary(uuid) set jit = off;

CREATE OR REPLACE FUNCTION finance.income_by_service(p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  m0 date := pg_catalog.date_trunc('month', p_from::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', p_to::timestamp)::date;
  tile numeric;
  rows jsonb;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  -- The tile is the same unified population as the rows below (manual units plus imported rows, whole
  -- months), summed from the service rows themselves — so the tile and the rows always agree and the gap
  -- is 0 by construction. A service row's revenue is its unit's revenue split by share, so the parts of
  -- one unit add up to that unit, and the whole set adds up to the period.
  with msr as materialized (
    select x.* from finance.money_service_row x where x.month_on between m0 and m1
  )
  select (select coalesce(sum(x.revenue), 0) from msr x),
         (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'part', g.part, 'service_id', g.service_id, 'service_key', sv.key, 'name_en', sv.name_en, 'name_ar', sv.name_ar,
                    'revenue', g.revenue, 'cost', g.cost, 'units', g.units)
                    order by pg_catalog.array_position(array['service', 'not_income', 'no_service', 'not_split'], g.part), sv.sort, sv.key),
                  '[]'::jsonb)
          from (select x.part, x.service_id, sum(x.revenue) as revenue,
                       coalesce(sum(x.cost) filter (where not x.provisional), 0) as cost,
                       pg_catalog.count(distinct (x.invoice_id, x.unit_kind))::int as units
                from msr x
                group by x.part, x.service_id) g
          left join finance.service sv on sv.id = g.service_id)
    into tile, rows;
  return pg_catalog.jsonb_build_object(
    'from', p_from, 'to', p_to, 'revenue', tile, 'rows', rows,
    'gap', tile - coalesce((select sum((e ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(rows) e), 0));
end
$function$;
-- CREATE OR REPLACE drops the setting (JIT-01..05 pin it): it is put back here
alter function finance.income_by_service(date, date) set jit = off;

-- the service rows: as they stood (20261119090000), the money rows taken once for both of their mentions
create or replace view finance.money_service_row with (security_invoker = true) as
 WITH mr AS MATERIALIZED (
         SELECT m.*
           FROM finance.money_row m
        ), u AS (
         SELECT r.invoice_id,
            r.unit_kind,
            r.ref,
            r.month_on,
            r.revenue,
            r.cost,
            r.provisional
           FROM mr r
          WHERE r.counted
        UNION ALL
         SELECT i.id AS invoice_id,
            i.mapped_kind AS unit_kind,
            i.number AS ref,
            date_trunc('month'::text, i.record_date::timestamp without time zone)::date AS month_on,
            i.revenue_sar AS revenue,
            i.cost_sar AS cost,
            i.cost_sar IS NULL AS provisional
           FROM finance.import_unit i
          WHERE i.fully_paid AND i.excluded_by IS NULL AND NOT i.promo_pool AND i.record_date IS NOT NULL AND NOT (EXISTS ( SELECT 1
                   FROM mr m
                  WHERE (m.counted OR m.excluded_by IS NOT NULL) AND m.partner_id = i.partner_id AND m.unit_kind = i.mapped_kind AND m.ref = i.number))
        ), lines AS (
         SELECT u.invoice_id,
            u.unit_kind,
                CASE
                    WHEN x.service_id IS NULL THEN 'no_service'::text
                    WHEN x.counts_as_income THEN 'service'::text
                    ELSE 'not_income'::text
                END AS part,
            x.service_id,
            x.total_sar
           FROM u
             JOIN finance.line_service x ON x.invoice_id = u.invoice_id AND NOT x.wallet
          WHERE u.unit_kind <> 'monthly_fee'::text
        ), parts AS (
         SELECT l.invoice_id,
            l.unit_kind,
            l.part,
            l.service_id,
            sum(l.total_sar) AS revenue
           FROM lines l
          GROUP BY l.invoice_id, l.unit_kind, l.part, l.service_id
        UNION ALL
         SELECT u.invoice_id,
            u.unit_kind,
            'not_split'::text,
            NULL::uuid,
            u.revenue - COALESCE(( SELECT sum(l.total_sar) AS sum
                   FROM lines l
                  WHERE l.invoice_id = u.invoice_id AND l.unit_kind = u.unit_kind), 0::numeric)
           FROM u
        ), shared AS (
         SELECT p.invoice_id,
            p.unit_kind,
            p.part,
            p.service_id,
            p.revenue,
            u.ref,
            u.month_on,
            u.provisional,
            u.cost AS unit_cost,
            u.revenue AS unit_revenue,
            round(u.cost *
                CASE
                    WHEN u.revenue = 0::numeric THEN 0::numeric
                    ELSE p.revenue / u.revenue
                END, 2) AS cost_part,
            row_number() OVER (PARTITION BY p.invoice_id, p.unit_kind ORDER BY (abs(p.revenue)) DESC, p.part, p.service_id) AS k
           FROM parts p
             JOIN u ON u.invoice_id = p.invoice_id AND u.unit_kind = p.unit_kind
          WHERE p.part <> 'not_split'::text OR p.revenue <> 0::numeric OR NOT (EXISTS ( SELECT 1
                   FROM lines l
                  WHERE l.invoice_id = p.invoice_id AND l.unit_kind = p.unit_kind))
        )
 SELECT invoice_id,
    unit_kind,
    ref,
    month_on,
    provisional,
    part,
    service_id,
    revenue,
    cost_part +
        CASE
            WHEN k = 1 THEN unit_cost - sum(cost_part) OVER (PARTITION BY invoice_id, unit_kind)
            ELSE 0::numeric
        END AS cost
   FROM shared s;
