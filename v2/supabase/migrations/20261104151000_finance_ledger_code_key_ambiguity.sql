-- Live failure, 4 Nov 2026: the Finance page and the company Finance tab both failed with
-- Postgres 42702 "column reference \"code_key\" is ambiguous" (25 POST 400s on
-- /rest/v1/rpc/finance_ledger, 19:55-20:10 +03, direct-commercial logs). Root cause: this
-- function's plpgsql variable was named code_key while finance.invoice.code_key (and
-- finance.money_row.code_key) are columns in the same query, so the bare name in the code
-- filter was ambiguous. The rename below changes NOTHING else: same signature, same grants,
-- same logic, same output shape. Forward-only: 20261104140000 is already applied to the
-- production database, so it is not edited; this migration replaces the function body.
-- The pilot's finance.unified_ledger calls finance.ledger, so it inherits this fix.

create or replace function finance.ledger(
  p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  client_key text := case when pg_catalog.btrim(coalesce(p_client_id, '')) = '' then null
                          else norm.digits_key(p_client_id, true) end;
  wanted_code text := case when pg_catalog.btrim(coalesce(p_code, '')) = '' then null
                         else norm.code_key(p_code) end;
  -- p_project is reserved (see the header): read so the argument is part of the call, matched by nothing yet.
  project_filter text := case when pg_catalog.btrim(coalesce(p_project, '')) = '' then null else p_project end;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  if p_kind is not null and p_kind not in ('transaction', 'standalone', 'billing', 'credit_note', 'wallet_topup') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end if;

  return (
    with rec as (
      select invoice_id, coalesce(sum(amount_sar), 0) as received
      from finance.receipt where deleted_at is null group by invoice_id
    ),
    -- Every revenue unit in the period, before the company filter: the company dropdown lists these, so picking
    -- a company never empties its own list.
    base as (
      select r.invoice_id, r.unit_kind, r.ref, r.partner_id, r.created_on, r.month_on, r.revenue,
             i.kind as invoice_kind, i.total_sar, i.figure_state,
             norm.fold(i.status_raw) as status_word, sm.maps_to as status_maps_to,
             bl.billing_invoice_id, bi.ref as billing_ref, bi.total_sar as billing_total,
             norm.fold(bi.status_raw) as billing_word, bsm.maps_to as billing_maps_to,
             coalesce(ti.dpin, tbi.dpin) as dpin,
             coalesce(ur.received, 0) as unit_received, coalesce(br.received, 0) as bill_received,
             c.cost_sar, c.approved_count, c.cost_basis
      from finance.money_row r
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
    -- Fully paid, by the owner's wordings (see the header). A gathered transaction is paid when its monthly
    -- invoice is paid, or when that invoice's receipts cover it.
    gated as (
      select b.*,
             case when b.unit_kind = 'monthly_fee' then 0
                  when b.cost_basis = 'no_supplier_cost' then 0
                  when coalesce(b.approved_count, 0) > 0 then b.cost_sar end as cost_out
      from base b
      -- norm.fold turns dashes, plus signs and brackets into spaces, so these are the folded wordings.
      where (b.status_word in ('invoice fully paid', 'fully paid', 'fully paid receivables',
                               'fully paid audit required', 'paid')
             or b.status_maps_to = 'paid'
             or b.billing_word in ('invoice fully paid', 'fully paid', 'fully paid receivables',
                                   'fully paid audit required', 'paid')
             or b.billing_maps_to = 'paid'
             or ((b.billing_invoice_id is not null
                  and b.billing_total is not null and b.bill_received >= b.billing_total)
                 or (b.billing_invoice_id is null
                     and b.total_sar is not null and b.unit_received >= b.total_sar))
                and coalesce(b.status_word, '') not in
                      ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                       'issued waiting for settlement')
                and coalesce(b.billing_word, '') not in
                      ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                       'issued waiting for settlement'))
        -- 'Fully Paid - Unpaid' is not in the accepted words above, so it only passes the remaining rule below,
        -- and a draft, cancelled or otherwise not-paid word never passes on remaining alone either.
        or (((b.billing_invoice_id is not null and b.billing_total is not null
              and b.billing_total - b.bill_received = 0)
             or (b.billing_invoice_id is null and b.total_sar is not null
                 and b.total_sar - b.unit_received = 0))
            and coalesce(b.status_word, '') not in
                  ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                   'issued waiting for settlement')
            and coalesce(b.billing_word, '') not in
                  ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                   'issued waiting for settlement'))
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
        from by_row r full join by_inv v on v.partner_id is not distinct from r.partner_id), '[]'::jsonb),
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
$$;
