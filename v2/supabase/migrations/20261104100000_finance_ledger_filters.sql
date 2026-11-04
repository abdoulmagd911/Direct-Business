-- Finance page filters, the saved-view ledger and the codes report (workstream B, 4 Nov 2026): one read,
-- finance.ledger, that answers the filtered view the Finance page draws and the Discount Codes page reuses
-- (parameterised by code — the same report, never a second one). The Finance page's own figures (finance_period)
-- stay as they are; this read is the ledger beneath them.
--
-- The owner's money rules of 4 Nov, as this read applies them:
-- - revenue is the invoice amount less any wallet top-up (finance.money_row already takes the wallet part off);
-- - cost is approved expenses only; a row with no approved expense and no no-supplier-cost product carries no cost
--   at all (empty, never 0), and its profit is empty too — the totals add only rows that carry a cost, and say how
--   many rows carry none, so the gap is visible rather than hidden inside a 0;
-- - a row counts only when it is fully paid, by its own words: 'Invoice - Fully Paid', 'Fully Paid',
--   'Fully Paid + Receivables', 'Fully Paid (Audit Required)', a receipt fully applied, a preview 'Paid', or a
--   remaining of 0.00 — plus anything finance.status_map already maps to paid, and a billing invoice's own words
--   for its gathered transactions. 'Fully Paid - Unpaid' counts only when its remaining really is 0. Draft,
--   cancelled, void, partly paid, waiting, unpaid and overdue words never count, even with receipts;
-- - settlement is never read and never shown; what is owed is the total less the receipts allocated to it;
-- - the record date is the creation date (created_on, exact days — this read does not snap to months the way
--   finance_period does);
-- - a transaction number and an invoice number are two different numbers: one invoice groups several transactions.
--   A transaction not yet gathered into a monthly invoice keeps its row with no invoice number yet, flagged, and
--   completes itself when a later import links it. A monthly invoice's excess over its transactions is a row of its
--   own with no transaction of its own, flagged as a monthly fee. A tax invoice (DPIN) is attached to its row and
--   never hides it, even when it covers only part of the invoice;
-- - Provisional is two flags on the row, not one word: cost pending (no approved expense yet) and waiting for
--   issuing (no tax invoice yet). Both are assumptions marked for the pilot review.
-- - p_project is accepted and stored in saved views, but changes nothing yet: no project link exists in the data,
--   so there is nothing honest to match it against. When the link lands, this read gains one more filter and the
--   saved views work without rework. The screen says so beside the box.
-- Forward-only (V103).

create function finance.ledger(
  p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  client_key text := case when pg_catalog.btrim(coalesce(p_client_id, '')) = '' then null
                          else norm.digits_key(p_client_id, true) end;
  code_key text := case when pg_catalog.btrim(coalesce(p_code, '')) = '' then null
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
        and (code_key is null or i.code_key = code_key)
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
             coalesce(sum(cost_out), 0) filter (where cost_out is not null) as cost,
             coalesce(sum(revenue - cost_out), 0) filter (where cost_out is not null) as profit,
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
$$;

create function api.finance_ledger(
  p_from date, p_to date, p_partner uuid default null, p_client_id text default null,
  p_kind text default null, p_code text default null, p_project text default null
) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.ledger(p_from, p_to, p_partner, p_client_id, p_kind, p_code, p_project) $$;

revoke all on function finance.ledger(date, date, uuid, text, text, text, text) from public;
revoke all on function api.finance_ledger(date, date, uuid, text, text, text, text) from public;
grant execute on function finance.ledger(date, date, uuid, text, text, text, text) to authenticated;
grant execute on function api.finance_ledger(date, date, uuid, text, text, text, text) to authenticated;
