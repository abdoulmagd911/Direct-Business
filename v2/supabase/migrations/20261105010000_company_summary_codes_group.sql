-- Fix 16, 5 Nov 2026: the company summary's codes list could never run.
--
-- What was live: partner.company_summary's codes subquery put sum() calls directly inside
-- jsonb_agg(...) — nested aggregate calls, which Postgres refuses — and selected the bare
-- s.code column with no GROUP BY. The bug was masked twice over: the old partners/view gate
-- raised before the body ever ran, and no test ever called the function until SUM-01 did.
-- SUM-01 (run #1550) exposed it as "aggregate function calls cannot be nested".
-- Fix: aggregate per code first (one row per code text, totals across its months), then
-- jsonb_agg over those rows, ordered by revenue descending. The output shape is unchanged
-- (code, units, revenue, profit per code). Nothing else in the function changes; the gate
-- from fix14 and the money gating by finance_visible are untouched. Forward-only.

-- Fix 14, 4 Nov 2026: the company Finance tab and the files archive used the wrong gate.
--
-- What was live: partner.company_summary and partner.company_files both opened with
-- authz.require('partners', 'view') — the blanket partners page level. The company page itself
-- (partner.partner_get) never used that gate: it opens for any active staff person the side rules
-- allow (partner.require_level, a side at view on this company). The signed-in Admin's person has
-- no partners/view, so every company_summary call failed with access.needs_level (25x 403 in the
-- live logs, 19:54-23:20 on 4 Nov) and the Finance tab showed only its failed state; the archive
-- swallowed the same failure as an empty list. The blanket level is not the page's gate, so the
-- blanket check is replaced, not the Admin's access rows:
--   * company_summary: the page's own gate (require_level on this company). The money inside stays
--     gated by finance_visible, exactly as before — a reader without Finance view gets nulls, never
--     zeros, and the tab shows no-access.
--   * company_files: any active staff person; every row stays gated by authz.file_visible, which is
--     the archive's documented contract ("only files the reader may see are listed").
-- Signatures unchanged, so grants and types are untouched. Forward-only.

create or replace function partner.company_summary(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
  return pg_catalog.jsonb_build_object(
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
      from finance.invoice_fact f where f.partner_id = p_partner and f.pay_state = 'paid') end,
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
        'cost_pending', exists (select 1 from finance.money_row x
                                where x.counted and x.partner_id = p_partner and x.provisional),
        'waiting_for_issuing', exists (select 1 from finance.money_row x
                                       join finance.invoice_fact f on f.id = x.invoice_id
                                       where x.counted and x.partner_id = p_partner and f.dpin is null),
        'waiting_count', (select pg_catalog.count(distinct x.invoice_id) from finance.money_row x
                          join finance.invoice_fact f on f.id = x.invoice_id
                          where x.counted and x.partner_id = p_partner and f.dpin is null))
      from finance.money_row r where r.partner_id = p_partner) end,
    'codes', case when finance_visible then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', g.code, 'units', g.units, 'revenue', g.revenue, 'profit', g.profit)
               order by g.revenue desc)
      from (select s.code, sum(s.units) as units, sum(s.revenue) as revenue, sum(s.profit) as profit
            from finance.sales_by_code s where s.partner_id = p_partner
            group by s.code) g), '[]'::jsonb) end,
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
               'approved_cost', (select sum(r.cost) from finance.money_row r
                                 join finance.invoice i on i.id = r.invoice_id
                                 join partner.identifier d on d.id = u.client_identifier_id
                                   and d.deleted_at is null and d.value_key = i.client_id_key
                                 where r.counted and not r.provisional),
               'cost_pending', exists (select 1 from finance.money_row r
                                       join finance.invoice i on i.id = r.invoice_id
                                       join partner.identifier d on d.id = u.client_identifier_id
                                         and d.deleted_at is null and d.value_key = i.client_id_key
                                       where r.counted and r.provisional),
               'actual_profit', case when u.signed_on is null then null
                 when (select sum(r.cost) from finance.money_row r
                       join finance.invoice i on i.id = r.invoice_id
                       join partner.identifier d on d.id = u.client_identifier_id
                         and d.deleted_at is null and d.value_key = i.client_id_key
                       where r.counted and not r.provisional) is null then null
                 else u.consumed - (select sum(r.cost) from finance.money_row r
                                    join finance.invoice i on i.id = r.invoice_id
                                    join partner.identifier d on d.id = u.client_identifier_id
                                      and d.deleted_at is null and d.value_key = i.client_id_key
                                    where r.counted and not r.provisional) end,
               -- No expected-cost field exists on a tender, so expected profit is never guessed.
               'expected_cost', null,
               'expected_profit', null)
               order by u.signed_on desc nulls last, u.number)
      from finance.tender_use u where u.partner_id = p_partner), '[]'::jsonb) end);
end
$$;;
