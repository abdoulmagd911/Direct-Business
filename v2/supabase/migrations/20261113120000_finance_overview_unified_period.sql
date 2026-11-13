-- L18 — Finance Overview reads the unified population (the two-totals fix, 13 Nov 2026).
-- The Overview (top cards, Months, By service) and the unified Ledger disagreed because they read
-- different populations: the Overview read only finance.money_row (manual invoices), while the Ledger
-- read finance.ledger UNION ALL the fully-paid work.import_record rows. Two imported rows
-- (TEST Gamma 1163000005, Revenue 700 cost pending; TEST Beta 1163000002, Revenue 500 Cost 100 Profit 400)
-- summed to exactly the gap (Revenue 1,200 / Cost 100 / Profit 400). Four parts:
--   (a) Give period_figures / money_month / income_by_service the Ledger's population (the import union).
--   (b) Align the fully-paid gate: money_row.counted is the Ledger's gated test, not only the unit's own status.
--   (c) Align the provisional rule in the Ledger: a provisional unit's cost is empty, never its approved-so-far cost.
--   (d) Guard against double counting: dedupe on natural keys across the two stores, preferring the manual row.
-- Forward-only (V103): nothing already on v2/main is edited here. No signature changes, so no grants or
-- generated-type changes. Regression tests: OVP-01 (Phase 7 provisional), UNI-02 (new: period_figures equals
-- unified_ledger totals for the same period), UNI-03 (new: a document imported through both doors counts
-- once — the (d) guard, both the standalone and the unconsolidated-transaction shapes).

-- ================================================================ (b) the fully-paid gate, in money_row_live
-- money_row_live.counted was only the unit's own invoice paid (pay_state = 'paid') and not excluded.
-- The Ledger's gated test is wider: the unit's own invoice paid, or its monthly (billing) invoice paid,
-- or receipts cover the total, or nothing remains — with the same barred wordings. A unit that is paid
-- through its monthly invoice, or whose receipts cover it, now counts in the Overview exactly as it
-- counts in the Ledger. The exclusion rule still wins (an excluded row never counts). The closed-month
-- snapshot override in finance.money_row is untouched: a closed month stays frozen as it was closed.
-- billing_link is unique per transaction_invoice_id while live, so at most one billing invoice per unit.
create or replace view finance.money_row_live with (security_invoker = true) as
with units as (
  select f.id as invoice_id, f.kind as unit_kind, f.ref, f.dpin, f.partner_id, f.match_state, f.month_on, f.created_on,
         f.paid_on, f.channel, f.channel_credits_owner, f.pay_state, f.audit_required, f.commission,
         f.total_sar - f.wallet_sar as revenue, c.cost_sar as cost, c.cost_status, f.code_key, c.estimate_sar as estimate
  from finance.invoice_fact f join finance.invoice_cost c on c.id = f.id
  union all
  select b.id, 'monthly_fee', b.ref, b.dpin, b.partner_id, b.match_state, b.month_on, b.created_on, b.paid_on, b.channel,
         b.channel_credits_owner, b.pay_state, b.audit_required, false,
         b.total_sar - t.linked_sar, 0::numeric, 'ready', b.code_key, null::numeric
  from finance.invoice_fact b
  join lateral (select sum(x.total_sar) as linked_sar from finance.billing_link l join finance.invoice x on x.id = l.transaction_invoice_id
                where l.billing_invoice_id = b.id and l.deleted_at is null and x.deleted_at is null) t on true
  where b.kind = 'billing' and t.linked_sar is not null and b.total_sar > t.linked_sar
    -- while a person has not ticked or dismissed the proposal for what the links lack, the excess is not a fee: it may
    -- be a transaction already counted on its own (QA-528)
    and not exists (select 1 from finance.billing_proposal p where p.billing_invoice_id = b.id and p.deleted_at is null
                    and p.state = 'open')
)
select u.invoice_id, u.unit_kind, u.ref, u.dpin, u.partner_id, u.match_state, u.month_on,
       pg_catalog.date_trunc('quarter', u.month_on::timestamp)::date as quarter_on, u.created_on, u.paid_on, u.channel,
       u.channel_credits_owner, u.pay_state, u.pay_state = 'paid' as paid, u.audit_required, u.commission,
       -- (b) the Ledger's fully-paid gate, word for word (finance.ledger, 20261104152000): the unit's own invoice
       -- paid, or its monthly invoice paid, or receipts cover the total, or nothing remains — with the barred
       -- wordings. The exclusion (x) still wins. The gate is a plain yes/no, never empty: a unit whose invoice
       -- carries no status and no monthly invoice (a wallet top-up, an unrecognised wording) is not counted,
       -- not left undecided — so coalesce the whole gate to false.
       coalesce(((norm.fold(inv.status_raw) in ('invoice fully paid', 'fully paid', 'fully paid receivables',
                                       'fully paid audit required', 'paid')
         or u.pay_state = 'paid'
         or bil.billing_word in ('invoice fully paid', 'fully paid', 'fully paid receivables',
                                 'fully paid audit required', 'paid')
         or bil.billing_maps_to = 'paid'
         or ((bl.billing_invoice_id is not null and bil.billing_total is not null
              and br.received >= bil.billing_total)
             or (bl.billing_invoice_id is null and inv.total_sar is not null
                 and ur.received >= inv.total_sar))
            and coalesce(norm.fold(inv.status_raw), '') not in
                  ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                   'issued waiting for settlement')
            and coalesce(bil.billing_word, '') not in
                  ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                   'issued waiting for settlement'))
        or (((bl.billing_invoice_id is not null and bil.billing_total is not null
              and bil.billing_total - br.received = 0)
             or (bl.billing_invoice_id is null and inv.total_sar is not null
                 and inv.total_sar - ur.received = 0))
            and coalesce(norm.fold(inv.status_raw), '') not in
                  ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                   'issued waiting for settlement')
            and coalesce(bil.billing_word, '') not in
                  ('draft', 'cancelled', 'void', 'partially paid', 'waiting', 'unpaid', 'overdue',
                   'issued waiting for settlement')))
       and x.id is null, false) as counted,
       x.kind as excluded_by, x.reason as excluded_reason,
       u.revenue, u.cost, u.cost_status, u.cost_status = 'provisional' as provisional,
       u.revenue - u.cost as profit, u.revenue - u.cost < 0 as loss,
       u.unit_kind = 'monthly_fee' as fee_on_monthly_invoice,
       coalesce(pt.subkind, case when u.code_key is not null then 'code' end) as payment_type,
       u.estimate,
       -- the organisation's Client type (V98), for every Finance filter and figure by segment
       (select t.key from partner.side_type t where t.id = measure.client_segment(u.partner_id)) as segment,
       measure.client_segment(u.partner_id) as segment_id
from units u
left join lateral finance.exclusion_of(u.invoice_id) x on x.id is not null
left join lateral (select d.subkind from finance.invoice i join partner.identifier d
                   on d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = i.client_id_key
                   where i.id = u.invoice_id limit 1) pt on true
left join lateral (select i.status_raw, i.total_sar from finance.invoice i where i.id = u.invoice_id) inv on true
left join lateral (select bl.billing_invoice_id from finance.billing_link bl
                   where bl.transaction_invoice_id = u.invoice_id and bl.deleted_at is null limit 1) bl on true
left join lateral (select bi.total_sar as billing_total, norm.fold(bi.status_raw) as billing_word,
                          bsm.maps_to as billing_maps_to
                   from finance.invoice bi
                   left join finance.status_map bsm on bsm.id = bi.status_id
                   where bi.id = bl.billing_invoice_id) bil on true
left join lateral (select coalesce(sum(r.amount_sar), 0) as received from finance.receipt r
                   where r.deleted_at is null and r.invoice_id = u.invoice_id) ur on true
left join lateral (select coalesce(sum(r.amount_sar), 0) as received from finance.receipt r
                   where r.deleted_at is null and r.invoice_id = bl.billing_invoice_id) br on true
where x.mode is distinct from 'hide';

-- ================================================================ (c) the provisional rule, in finance.ledger
-- The Ledger's cost_out counted a provisional unit's approved-so-far cost (approved_count > 0 → cost_sar),
-- while the Overview excludes a provisional unit from cost and profit entirely (Phase 7, rulebook §16, CUJ 8).
-- Now the Ledger follows the same rule: a provisional unit's cost is empty, never its approved-so-far cost.
-- monthly_fee → 0 and no_supplier_cost → 0 are kept. The gate now lives in money_row.counted (part b),
-- so the Ledger reads counted instead of its own duplicate gated test.
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
$$;

-- ================================================================ (a) the Overview reads the unified population
-- The import branch, copied unchanged from finance.unified_ledger (20261106133000): the fully-paid
-- transaction/invoice rows, with an invoice-only row dropped when its transactions are already there.
-- It is repeated in each read below because each read has its own period and shape; the logic is identical.
-- A row the old import door also wrote into finance.invoice is counted once, not twice (part d): the import
-- branch drops a row whose partner and number already sit in money_row as a counted unit.

-- Per month: the counted units' revenue over every unit, cost and profit over the costed units only, and the
-- Provisional units' revenue and profit beside them — never left out (V611); losses counted (V414).
-- Now over the unified population: manual units plus imported rows, grouped by their month.
create or replace view finance.money_month with (security_invoker = true) as
with import_base as (
  select r.id, r.partner_id, r.kind, r.transaction_ref, r.invoice_ref, r.record_date,
         r.revenue_sar, r.cost_sar, r.profit_sar, r.attribution_promo,
         case when r.kind = 'transaction' then 'transaction'
              when r.transaction_ref is not null then 'transaction'
              else 'standalone' end as mapped_kind
  from work.import_record r
  where r.deleted_at is null and r.kind in ('transaction', 'invoice')
    and r.fully_paid and r.revenue_sar is not null
    and r.record_date is not null
    and not r.attribution_promo
    and not (r.kind = 'invoice' and r.transaction_ref is null and exists (
          select 1 from work.import_record t where t.deleted_at is null and t.partner_id = r.partner_id
            and t.transaction_ref is not null and t.invoice_ref = r.invoice_ref))
    -- (d) a row the old door also wrote into finance.invoice is counted once, as the manual unit.
    and not exists (select 1 from finance.money_row m where m.counted and m.partner_id = r.partner_id
                    and (m.ref = r.invoice_ref or m.ref = r.transaction_ref))
),
r as (
  select x.month_on, x.revenue, x.cost, x.profit, x.provisional, x.loss
  from finance.money_row x where x.counted
  union all
  select pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
         i.revenue_sar as revenue, i.cost_sar as cost, i.profit_sar as profit,
         (i.cost_sar is null) as provisional, (i.profit_sar < 0) as loss
  from import_base i
)
select r.month_on, count(*)::int as units, sum(r.revenue) as revenue,
       coalesce(sum(r.cost) filter (where not r.provisional), 0) as cost,
       coalesce(sum(r.profit) filter (where not r.provisional), 0) as profit,
       count(*) filter (where r.provisional)::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
       count(*) filter (where r.loss)::int as losses
from r
group by r.month_on;
comment on view finance.money_month is
  'Per month (V611): revenue over every counted unit; cost and profit over the costed units only — a unit whose cost is provisional is excluded from both and shown apart as Provisional, its cost empty, never 0 (rulebook §16, Phase 7). Since L18 it reads the unified population: manual units plus imported rows.';

-- The counted units of the period (exact days, V610): revenue over every paid unit, cost and profit over the
-- costed units only, the Provisional part of each beside it, and the same per month. Since L18 the period is
-- the exact days asked for (created_on / record_date between p_from and p_to), not whole months — the Ledger
-- reads the same days, so the two totals agree.
create or replace function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with import_base as (
      select r.id, r.partner_id, r.kind, r.transaction_ref, r.invoice_ref, r.record_date,
             r.revenue_sar, r.cost_sar, r.profit_sar, r.attribution_promo,
             case when r.kind = 'transaction' then 'transaction'
                  when r.transaction_ref is not null then 'transaction'
                  else 'standalone' end as mapped_kind
      from work.import_record r
      where r.deleted_at is null and r.kind in ('transaction', 'invoice')
        and r.fully_paid and r.revenue_sar is not null
        and r.record_date between p_from and p_to
        and not r.attribution_promo
        and not (r.kind = 'invoice' and r.transaction_ref is null and exists (
              select 1 from work.import_record t where t.deleted_at is null and t.partner_id = r.partner_id
                and t.transaction_ref is not null and t.invoice_ref = r.invoice_ref))
        -- (d) a row the old door also wrote into finance.invoice is counted once, as the manual unit.
        and not exists (select 1 from finance.money_row m where m.counted and m.partner_id = r.partner_id
                        and (m.ref = r.invoice_ref or m.ref = r.transaction_ref))
    ),
    r as (
      select x.month_on, x.revenue, x.cost, x.profit, x.provisional, x.loss, x.estimate
      from finance.money_row x where x.counted and x.created_on between p_from and p_to
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
$$;

-- Each counted unit × part, now over the unified population: imported rows have no invoice lines, so they
-- land whole as "Not split" (their product maps through the item map only where a line exists — it does not
-- for an import). Their invoice_id is the import row's own id, which never matches a finance line, so no
-- line is ever double-counted.
create or replace view finance.money_service_row with (security_invoker = true) as
with u as (
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.cost, r.provisional
  from finance.money_row r where r.counted
  union all
  select i.id as invoice_id,
         case when i.kind = 'transaction' then 'transaction'
              when i.transaction_ref is not null then 'transaction'
              else 'standalone' end as unit_kind,
         coalesce(i.transaction_ref, i.invoice_ref) as ref,
         pg_catalog.date_trunc('month', i.record_date::timestamp)::date as month_on,
         i.revenue_sar as revenue, i.cost_sar as cost, (i.cost_sar is null) as provisional
  from work.import_record i
  where i.deleted_at is null and i.kind in ('transaction', 'invoice')
    and i.fully_paid and i.revenue_sar is not null
    and i.record_date is not null
    and not i.attribution_promo
    and not (i.kind = 'invoice' and i.transaction_ref is null and exists (
          select 1 from work.import_record t where t.deleted_at is null and t.partner_id = i.partner_id
            and t.transaction_ref is not null and t.invoice_ref = i.invoice_ref))
    -- (d) a row the old door also wrote into finance.invoice is counted once, as the manual unit.
    and not exists (select 1 from finance.money_row m where m.counted and m.partner_id = i.partner_id
                    and (m.ref = i.invoice_ref or m.ref = i.transaction_ref))
),
lines as (
  select u.invoice_id, u.unit_kind,
         case when x.service_id is null then 'no_service' when x.counts_as_income then 'service' else 'not_income' end
           as part,
         x.service_id, x.total_sar
  from u join finance.line_service x on x.invoice_id = u.invoice_id and not x.wallet
  where u.unit_kind <> 'monthly_fee'
),
parts as (
  select l.invoice_id, l.unit_kind, l.part, l.service_id, sum(l.total_sar) as revenue
  from lines l group by l.invoice_id, l.unit_kind, l.part, l.service_id
  union all
  select u.invoice_id, u.unit_kind, 'not_split', null,
         u.revenue - coalesce((select sum(l.total_sar) from lines l
                               where l.invoice_id = u.invoice_id and l.unit_kind = u.unit_kind), 0)
  from u
),
shared as (
  select p.*, u.ref, u.month_on, u.provisional, u.cost as unit_cost, u.revenue as unit_revenue,
         pg_catalog.round(u.cost * case when u.revenue = 0 then 0 else p.revenue / u.revenue end, 2) as cost_part,
         pg_catalog.row_number() over (partition by p.invoice_id, p.unit_kind
                                       order by pg_catalog.abs(p.revenue) desc, p.part, p.service_id) as k
  from parts p join u on u.invoice_id = p.invoice_id and u.unit_kind = p.unit_kind
  where p.part <> 'not_split' or p.revenue <> 0 or not exists (
    select 1 from lines l where l.invoice_id = p.invoice_id and l.unit_kind = p.unit_kind)
)
select s.invoice_id, s.unit_kind, s.ref, s.month_on, s.provisional, s.part, s.service_id, s.revenue,
       s.cost_part + case when s.k = 1 then s.unit_cost - sum(s.cost_part) over (partition by s.invoice_id, s.unit_kind)
                          else 0 end as cost
from shared s;
comment on view finance.money_service_row is 'D24 (§3.6): each counted unit''s revenue by service; services + not income + no service yet + not split = the unit''s revenue, and its cost split by share adds up to its cost. Since L18 it reads the unified population: imported rows land whole as Not split.';

-- The period by service, for Finance → Income by service: each part's revenue, cost and units, and the revenue tile
-- beside them with the gap between (0, or named — never rounded away). Since L18 the tile and the rows read the
-- unified population (manual units plus imported rows), and the cost sum excludes provisional units — matching
-- money_month — so a provisional unit's approved-so-far cost never leaks into a service's cost. The rows and the
-- tile are whole months (m0/m1), as before: for a custom partial-month range the Overview tiles (exact days)
-- and this read can still differ, because the service rows carry only their month, not their day — a known
-- residual, not fixed here (it needs a day column on the service rows).
-- Note: this read has no profit sum (its rows carry revenue, cost and units only); the provisional filter that
-- was missing is on cost alone.
create or replace function finance.income_by_service(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
  select coalesce(sum(x.revenue), 0) into tile from finance.money_service_row x where x.month_on between m0 and m1;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'part', g.part, 'service_id', g.service_id, 'service_key', sv.key, 'name_en', sv.name_en, 'name_ar', sv.name_ar,
           'revenue', g.revenue, 'cost', g.cost, 'units', g.units)
           order by pg_catalog.array_position(array['service', 'not_income', 'no_service', 'not_split'], g.part), sv.sort, sv.key),
         '[]'::jsonb)
    into rows
  from (select x.part, x.service_id, sum(x.revenue) as revenue,
               coalesce(sum(x.cost) filter (where not x.provisional), 0) as cost,
               pg_catalog.count(distinct (x.invoice_id, x.unit_kind))::int as units
        from finance.money_service_row x
        where x.month_on between m0 and m1
        group by x.part, x.service_id) g
  left join finance.service sv on sv.id = g.service_id;
  return pg_catalog.jsonb_build_object(
    'from', p_from, 'to', p_to, 'revenue', tile, 'rows', rows,
    'gap', tile - coalesce((select sum((e ->> 'revenue')::numeric) from pg_catalog.jsonb_array_elements(rows) e), 0));
end
$$;

-- ================================================================ (d) the unified ledger dedupes across the stores
-- The Ledger's dedupe keyed on (source, invoice_id, unit_kind, transaction_number, invoice_number): a row
-- present in both stores kept both copies, because the sources differ ('manual' vs 'import'). Now the key is
-- the natural key across sources (partner, kind, the document's own number — coalesce of the transaction and
-- invoice numbers, since the two stores put it in different columns), preferring the manual row — a file
-- imported through both doors counts once. There is no such overlap in the live data, so no total moves today;
-- this is the guard.
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
    -- (d) Dedupe on the natural key across the stores — partner, kind, and the document's own
    -- number — preferring the manual row. The number is coalesce(transaction_number,
    -- invoice_number): the two stores put the same document's number in different columns — a
    -- standalone invoice's import row carries it only as the invoice number (its transaction
    -- number is empty), while the manual row carries it as both; an unconsolidated
    -- transaction's manual row carries no invoice number, while the import row carries both.
    -- Keying on the two columns separately never matches those shapes, so the document counted
    -- twice (proven by the L18 elephant guard test: both shapes doubled the Ledger totals
    -- while the Overview stayed right). The coalesced number IS the document: two rows sharing
    -- it for one partner and kind are the same document, through either door.
    deduped as (
      select distinct on (partner_id, unit_kind, coalesce(transaction_number, invoice_number))
             invoice_id, unit_kind, transaction_number, invoice_number, partner_id, created_on,
             revenue, cost, profit, dpin, flags, source, is_promo, discount_sar, amount_sar
      from combined_rows
      order by partner_id, unit_kind, coalesce(transaction_number, invoice_number) nulls last,
               case when source = 'manual' then 0 else 1 end, invoice_id
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
    -- Invoices from the deduped imported rows (not from every imported row), so the list never
    -- shows an invoice the totals did not count — a row the (d) dedup drops as a manual
    -- duplicate leaves no invoice behind, and its received/remaining are not counted twice.
    -- The total is the invoice amount itself (not revenue, which has the wallet part taken
    -- off); a fully paid invoice has all of it received and nothing remaining.
    import_invoices as (
      select 'import:' || invoice_number as invoice_id, invoice_number,
             pg_catalog.min(unit_kind) as kind, partner_id,
             coalesce(pg_catalog.max(case when transaction_number is null then amount_sar end),
                      pg_catalog.sum(amount_sar)) as total_sar,
             coalesce(pg_catalog.max(case when transaction_number is null then amount_sar end),
                      pg_catalog.sum(amount_sar)) as received_sar,
             0::numeric as remaining_sar, pg_catalog.max(dpin) as dpin,
             coalesce(pg_catalog.array_agg(transaction_number) filter (where transaction_number is not null), '{}') as transactions
      from deduped
      where source = 'import' and invoice_number is not null
      group by partner_id, invoice_number
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
