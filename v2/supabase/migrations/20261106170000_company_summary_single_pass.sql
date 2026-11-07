-- Fix23 (6 Nov 2026): partner.company_summary was timing out live with Postgres 57014 statement
-- timeout (7.8-10.4 s per Finance-tab call) and is rewritten as a one-pass query: the money_row
-- view stack is evaluated once per block instead of ~6+ times per call.
--
-- Live diagnosis (6 Nov 2026, 19:09-19:26, read-only): the live database has exactly 1 invoice,
-- 0 closed months, 0 tenders, 5 work.import_record rows. JIT is already OFF globally
-- (pg_settings jit=off) AND on partner.company_summary, so JIT is NOT the cause of the live
-- slowness. The Nano is at CPU 97%; every primitive is ~100-1000x slower than normal. The live
-- 6-10 s is instance saturation (CPU 97%) PLUS the function's structural ~6x recompute. This
-- migration removes the recompute; the compute upgrade is still needed for headroom (see the
-- fix23 investigation report), but this is the code fix that removes the immediate failure.
--
-- What the profiler proved locally (fix23-profile/REPORT.md, from-zero DB at c4f013a, pilot TEST
-- data): the function recomputes finance.money_row ~6+ times per call with no partner filter
-- pushdown (wallet 1x via invoice_fact; finance block 4x; codes 1x via finance.sales_by_code,
-- which groups the whole counted coded population first; tenders 1x per tender in the
-- tender_use lateral plus up to 3x per tender row). Planning is ~130-360 ms even with tiny data;
-- execution scales ~0.7 ms per finance.invoice row. At 5,001 invoice rows the call is ~3.4 s
-- locally, the codes branch alone ~3.3 s. The fix21 jit=off setting is load-bearing (the same
-- query with JIT on takes 66 s locally) and must NOT be lost.
--
-- Claude's six required changes, and where each is addressed:
--   1. Live diagnosis — DONE before this build (see above); not a migration change.
--   2. jit=off set by THIS migration — a CREATE OR REPLACE silently drops the function's
--      JIT-off setting (the ALTER is a separate setting; CREATE OR REPLACE resets proconfig),
--      which would bring back the 66-second JIT case. So AFTER the CREATE OR REPLACE, in this
--      SAME file, the ALTER FUNCTION ... SET jit = off is repeated. Fix21's own migration is
--      untouched.
--   3. Codes block — MANDATORY, not optional: the codes block is 3.3 of 3.55 seconds at scale.
--      The full-population finance.sales_by_code call is replaced by a per-partner aggregate over
--      this partner's money_row rows, reusing the sales_by_code row definition (money_row joined
--      to invoice where counted and code_key is not null; code = min(discount_code_raw);
--      units = count, revenue = sum, profit = sum; joined to partner.identifier (discount_code)
--      and partner.campaign_code for the label, as sales_by_code does), grouped by code text.
--      The view itself is never called: it groups ALL partners/months first, then filters.
--      One known boundary: the old code attributed a unit to the code's HOLDER (the identifier's
--      partner), while this pass reads this partner's own money rows. The two agree whenever a
--      code is used on its holder's own invoices — which is the normal case, because
--      finance.partner_match resolves an invoice to its code's holder whenever no client ID,
--      tax number or email outranks the code. They differ only for a unit whose invoice is
--      matched to another partner (via a client ID or a pin) while carrying this partner's
--      discount code; that unit moves out of this partner's codes list. The regression test
--      (SUM-02) compares old vs new on the built fixtures, which carry no such unit.
--   4. Flag fold null fix — the folded flags use COALESCE(bool_or(...), false), so cost_pending
--      and waiting_for_issuing return FALSE, never null, when there are no matching rows, exactly
--      like the old exists(...) subqueries; waiting_count is count(distinct ...) and is always a
--      number (0 when empty), as before. See the finance block comment.
--   5. Tender approved-cost reuse — each tender's approved_cost is computed ONCE per tender in
--      a single LATERAL per tender row and reused for approved_cost, cost_pending and
--      actual_profit. The old code evaluated the same SUM three times per tender row (once
--      directly, twice inside actual_profit's CASE). See the tenders block comment.
--   6. Identical output — the gate, the wallet block, the return shape and EVERY figure are
--      unchanged: the same numbers, faster. The proof is the regression test (SUM-02, built by a
--      separate worker): old vs new on the same fixtures.
--
-- The three body changes:
--   (1) Finance block: ONE money_row evaluation instead of four. cost_pending,
--       waiting_for_issuing and waiting_count are folded into the main aggregate instead of
--       three separate correlated subqueries that each re-scanned money_row (and, for the waiting
--       flags, invoice_fact again). The invoice_fact join is done ONCE in the main FROM
--       (LEFT JOIN finance.invoice_fact on invoice_id) and the flags are FILTER / boolean
--       aggregates over that single pass. The LEFT JOIN cannot multiply rows: invoice_fact is
--       exactly one row per invoice (billing_link is unique per transaction_invoice_id,
--       tax_invoice is unique per parent_invoice_id, every other join is on a primary key or a
--       one-row lateral). money_row already exposes dpin, but the join is kept so the waiting
--       flags keep the old inner join's exact meaning (see the block comment).
--   (2) Tenders: approved_cost computed once per tender (single LATERAL) and reused (change #5).
--       Tender rows still come from finance.tender_use, as before.
--   (3) Codes: per-partner aggregate over this partner's money_row rows (change #3).
--
-- Signature unchanged (partner.company_summary(uuid) returns jsonb), so no types change and no
-- grants change (CREATE OR REPLACE preserves grants). The gate (authz.me() + require_level +
-- finance_visible), the wallet block, the return shape and every figure are UNCHANGED. Nothing
-- here touches finance.ledger, finance.unified_ledger or work.import_record. Forward-only: a new
-- migration; the applied company_summary migrations are never edited.

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
      from finance.money_row r
      left join finance.invoice_fact f on f.id = r.invoice_id
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
            from finance.money_row r
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
        from finance.money_row r
        join finance.invoice i on i.id = r.invoice_id
        join partner.identifier d on d.id = u.client_identifier_id
          and d.deleted_at is null and d.value_key = i.client_id_key
        where r.counted
      ) a on true
      where u.partner_id = p_partner), '[]'::jsonb) end);
end
$$;

-- Fix23 (change #2): CREATE OR REPLACE above silently drops the function's JIT-off setting
-- (the ALTER is a separate setting; CREATE OR REPLACE resets proconfig). Without this line the
-- 66-second JIT case comes back. Fix21's own migration is untouched; this repeats its setting
-- in the same migration as the rewrite, so the function is never left without jit=off.
alter function partner.company_summary(uuid) set jit = off;
