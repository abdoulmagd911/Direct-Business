-- Landing 47 — Finance Part B, items A11, A10, A6 and A13: four reads. Each is a read of its own beside the money
-- reads — none of them changes what counts, and no existing function is touched.
--
-- A11. Held, never dropped. finance.held_rows lists, for a period, every unit that Finance cannot tie firmly:
--        no_organisation — a row recorded here that matches no organisation;
--        no_client_id    — a row recorded here whose invoice carries no client ID, or an imported row whose
--                          organisation holds no client ID at all;
--        same_number     — one number found under more than one organisation (or as two kinds of document).
--      They stay where they are and count as they counted: the list is the place they are held in view, with
--      their amounts, until a person ties them. Two rules meet here and are told apart on purpose:
--        the same DOCUMENT through both doors (same organisation, same kind, same number) is ONE row — the row
--          recorded here is kept (L18, UNI-03);
--        two DOCUMENTS that only share a number (another organisation, or another kind) are TWO rows, both kept
--          (FND-09) — and listed here as same_number so a person can look;
--        a number REPEATED inside one file is one document written twice: the oldest is kept (the preview's rule,
--          src/modules/imports/preview.ts; the engine's keys allow one row per number and organisation).
-- A10. Finance agrees with itself. finance.reconciliation puts the two sides of a period next to each other — the
--      Finance page's figures (finance.period_figures) and the Ledger's totals (finance.unified_ledger) — and lists
--      every gap: a figure the two sides disagree on, a counted row whose profit is not its revenue less its cost,
--      an imported row whose cost is not the sum of its own expense lines, organisations' lines that do not add up
--      to the Ledger's total. An empty list means agreement. Any gap is listed; one of 1 SAR or more is a failure.
--      A credit on an expense lowers the cost on its row (a negative expense line, 20261124090000) — the Fully Paid
--      record itself is never rewritten, and the two sides keep agreeing (REC-02).
-- A6.  Outstanding and how old. finance.ageing lists what is still owed — the documents not fully paid: the
--      receivables recorded here (finance.receivable) and the imported rows not confirmed paid — each with its
--      age in days since it was issued and its bucket (0–30, 31–60, 61–90, over 90), and the same by organisation.
--      It is the pursue list for postpaid: by default it keeps the rows of a postpaid deal and the rows whose deal
--      type is not set (so none is hidden by a missing flag); p_all lists every deal type.
-- A13. A contract paid in several payments. finance.contract_payments answers, for one contract, the Ledger's own
--      rows of that organisation dated inside the contract's term, grouped by month or by quarter: each period's
--      total, and under it each invoice. It regroups the Ledger's answer — it counts nothing by itself.
-- Forward-only (V103). Regression tests: HLD-01, REC-02, AGE-01, CTR-01.

-- ================================================================ A11 — held, never dropped
create function finance.held_rows(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with manual as (
      select 'manual'::text as source, m.ref as number, m.unit_kind, m.partner_id, m.created_on,
             m.revenue as amount, m.counted, i.client_id_key
      from finance.money_row m
      join finance.invoice i on i.id = m.invoice_id
      where m.created_on between p_from and p_to and m.excluded_by is null
        and coalesce(m.pay_state, '') not in ('cancelled', 'void')
    ),
    imported as (
      select 'import'::text as source, u.number, u.mapped_kind as unit_kind, u.partner_id, u.record_date as created_on,
             coalesce(u.revenue_sar, u.amount_sar) as amount, u.fully_paid as counted
      from finance.import_unit u
      where u.record_date between p_from and p_to and u.excluded_by is null
        and coalesce(norm.fold(u.status_text), '') not in ('cancelled', 'canceled', 'void', 'voided')
        -- the same document recorded here is listed once, as the row recorded here (L18)
        and not exists (select 1 from manual x where x.partner_id is not distinct from u.partner_id
                        and x.unit_kind = u.mapped_kind and norm.fold(x.number) = norm.fold(u.number))
    ),
    every as (
      select source, number, unit_kind, partner_id, created_on, amount, counted from manual
      union all
      select source, number, unit_kind, partner_id, created_on, amount, counted from imported
    ),
    held as (
      select 'no_organisation'::text as reason, e.* from every e where e.partner_id is null
      union all
      select 'no_client_id', m.source, m.number, m.unit_kind, m.partner_id, m.created_on, m.amount, m.counted
      from manual m where m.partner_id is not null and m.client_id_key is null
      union all
      select 'no_client_id', u.* from imported u
      where not exists (select 1 from partner.identifier d where d.partner_id = u.partner_id and d.deleted_at is null
                        and d.kind = 'payments_client_id')
      union all
      select 'same_number', e.* from every e
      where e.number is not null and exists (
        select 1 from every o where norm.fold(o.number) = norm.fold(e.number)
          and (o.partner_id is distinct from e.partner_id or o.unit_kind is distinct from e.unit_kind))
    ),
    named as (
      select h.*, p.number as partner_number, p.trade_name_en, p.trade_name_ar,
             pg_catalog.row_number() over (order by h.reason, h.created_on desc nulls last, h.number, h.source) as o
      from held h left join partner.partner p on p.id = h.partner_id
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'totals', coalesce((select pg_catalog.jsonb_object_agg(g.reason, pg_catalog.jsonb_build_object('units', g.units, 'amount', g.amount))
                          from (select reason, pg_catalog.count(*)::int as units, coalesce(pg_catalog.sum(amount), 0) as amount
                                from named group by reason) g), '{}'::jsonb),
      'units', (select pg_catalog.count(*)::int from named),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'reason', n.reason, 'source', n.source, 'number', n.number, 'unit_kind', n.unit_kind,
          'partner_id', n.partner_id, 'partner_number', n.partner_number,
          'trade_name_en', n.trade_name_en, 'trade_name_ar', n.trade_name_ar,
          'created_on', n.created_on, 'amount', n.amount, 'counted', n.counted) order by n.o)
        from named n where n.o <= 500), '[]'::jsonb),
      'truncated', (select pg_catalog.count(*) > 500 from named))
  );
end
$$;
alter function finance.held_rows(date, date) set jit = off;
comment on function finance.held_rows(date, date) is 'Landing 47 (A11): the units of a period held in view — no organisation, no client ID, or a number found under more than one organisation. They count as they counted; nothing is dropped.';
create function api.finance_held_rows(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.held_rows(p_from, p_to) $$;

-- ================================================================ A10 — Finance agrees with itself
create function finance.reconciliation(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ov jsonb;
  ul jsonb;
  gaps jsonb := '[]'::jsonb;
  fig text;
  a numeric;
  b numeric;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  ov := finance.period_figures(p_from, p_to);
  ul := finance.unified_ledger_core(p_from, p_to, null, null, null, null, null);
  -- 1. the two sides, figure by figure (an empty cost is no cost: it agrees with 0)
  foreach fig in array array['units', 'revenue', 'cost', 'profit'] loop
    a := coalesce((ov ->> fig)::numeric, 0);
    b := coalesce((ul -> 'totals' ->> fig)::numeric, 0);
    if a <> b then
      gaps := gaps || pg_catalog.jsonb_build_object('kind', 'sides', 'figure', fig, 'left', a, 'right', b,
        'difference', a - b, 'failing', fig = 'units' or pg_catalog.abs(a - b) >= 1);
    end if;
  end loop;
  -- 2. a counted row whose profit is not its revenue less its cost
  gaps := gaps || coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', 'row_profit', 'number', r ->> 'number',
             'source', r ->> 'source', 'partner_id', r ->> 'partner_id',
             'left', (r ->> 'profit')::numeric, 'right', (r ->> 'revenue')::numeric - (r ->> 'cost')::numeric,
             'difference', (r ->> 'profit')::numeric - ((r ->> 'revenue')::numeric - (r ->> 'cost')::numeric),
             'failing', pg_catalog.abs((r ->> 'profit')::numeric - ((r ->> 'revenue')::numeric - (r ->> 'cost')::numeric)) >= 1)
           order by r ->> 'number')
    from pg_catalog.jsonb_array_elements(ul -> 'rows') r
    where coalesce((r ->> 'counted')::boolean, true)
      and (r ->> 'revenue') is not null and (r ->> 'cost') is not null and (r ->> 'profit') is not null
      and (r ->> 'profit')::numeric <> (r ->> 'revenue')::numeric - (r ->> 'cost')::numeric), '[]'::jsonb);
  -- 3. an imported row whose cost is not the sum of its own expense lines
  gaps := gaps || coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', 'cost_lines', 'number', u.number, 'source', 'import',
             'partner_id', u.partner_id, 'left', u.cost_sar, 'right', k.lines,
             'difference', coalesce(u.cost_sar, 0) - k.lines,
             'failing', pg_catalog.abs(coalesce(u.cost_sar, 0) - k.lines) >= 1) order by u.number)
    from finance.import_unit u
    join work.import_record c on c.id = u.id
    join lateral (select pg_catalog.sum(pg_catalog.split_part(x, '|', 1)::numeric) as lines
                  from pg_catalog.unnest(c.expense_keys) x) k on true
    where u.record_date between p_from and p_to and pg_catalog.cardinality(c.expense_keys) > 0
      and coalesce(u.cost_sar, 0) <> k.lines), '[]'::jsonb);
  -- 4. the organisations' lines add up to the Ledger's own total
  for fig in select pg_catalog.unnest(array['revenue', 'cost', 'profit']) loop
    a := coalesce((select pg_catalog.sum((c ->> fig)::numeric) from pg_catalog.jsonb_array_elements(ul -> 'by_company') c), 0);
    b := coalesce((ul -> 'totals' ->> fig)::numeric, 0);
    if a <> b then
      gaps := gaps || pg_catalog.jsonb_build_object('kind', 'organisations', 'figure', fig, 'left', a, 'right', b,
        'difference', a - b, 'failing', pg_catalog.abs(a - b) >= 1);
    end if;
  end loop;
  return pg_catalog.jsonb_build_object(
    'from', p_from, 'to', p_to,
    'overview', pg_catalog.jsonb_build_object('units', (ov ->> 'units')::int, 'revenue', (ov ->> 'revenue')::numeric,
      'cost', (ov ->> 'cost')::numeric, 'profit', (ov ->> 'profit')::numeric),
    'ledger', pg_catalog.jsonb_build_object('units', (ul -> 'totals' ->> 'units')::int,
      'revenue', (ul -> 'totals' ->> 'revenue')::numeric, 'cost', (ul -> 'totals' ->> 'cost')::numeric,
      'profit', (ul -> 'totals' ->> 'profit')::numeric),
    'gaps', gaps,
    'agrees', pg_catalog.jsonb_array_length(gaps) = 0,
    'failing', (select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(gaps) g where (g ->> 'failing')::boolean),
    'rows_truncated', coalesce((ul ->> 'truncated')::boolean, false));
end
$$;
alter function finance.reconciliation(date, date) set jit = off;
comment on function finance.reconciliation(date, date) is 'Landing 47 (A10): the Finance page''s figures beside the Ledger''s totals for a period, and every gap between and inside them. An empty gaps list means Finance agrees with itself.';
create function api.finance_reconciliation(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.reconciliation(p_from, p_to) $$;

-- ================================================================ A6 — outstanding and how old
create function finance.ageing(p_partner uuid default null, p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := core.riyadh_today();
begin
  perform authz.require('finance', 'view');
  return (
    with owed as (
      -- recorded here: what finance.receivable says is still owed
      select 'manual'::text as source, r.ref as number, r.kind, r.partner_id, r.issued_on, r.due_date,
             r.outstanding, (select d.deal_type from finance.invoice_deal(r.invoice_id, r.partner_id) d) as deal_type
      from finance.receivable r
      where r.outstanding > 0 and (p_partner is null or r.partner_id = p_partner)
      union all
      -- imported: a row not confirmed paid owes its amount (its receipts are not read)
      select 'import', u.number, u.mapped_kind, u.eff_partner_id, u.record_date, null::date,
             u.amount_sar, (select d.deal_type from finance.import_deal(u.id) d)
      from finance.import_unit u
      where not u.fully_paid and u.excluded_by is null and coalesce(u.amount_sar, 0) > 0
        and coalesce(norm.fold(u.status_text), '') not in ('cancelled', 'canceled', 'void', 'voided', 'draft')
        and (p_partner is null or u.eff_partner_id = p_partner)
        and not exists (select 1 from finance.invoice i where i.deleted_at is null and norm.fold(i.ref) = norm.fold(u.number))
    ),
    aged as (
      select o.*, greatest(today - o.issued_on, 0) as age_days,
             case when o.issued_on is null then 'no_date'
                  when today - o.issued_on <= 30 then 'days_0_30'
                  when today - o.issued_on <= 60 then 'days_31_60'
                  when today - o.issued_on <= 90 then 'days_61_90'
                  else 'days_over_90' end as bucket
      from owed o
      where p_all or o.deal_type = 'postpaid' or o.deal_type is null
    ),
    named as (
      select a.*, p.number as partner_number, p.trade_name_en, p.trade_name_ar,
             pg_catalog.row_number() over (order by a.age_days desc nulls last, a.outstanding desc, a.number) as o
      from aged a left join partner.partner p on p.id = a.partner_id
    )
    select pg_catalog.jsonb_build_object(
      'as_of', today, 'partner', p_partner, 'all', p_all,
      'outstanding', coalesce((select pg_catalog.sum(outstanding) from named), 0),
      'units', (select pg_catalog.count(*)::int from named),
      'buckets', coalesce((select pg_catalog.jsonb_object_agg(b.bucket, b.amount)
                           from (select bucket, pg_catalog.sum(outstanding) as amount from named group by bucket) b), '{}'::jsonb),
      'companies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'partner_id', c.partner_id, 'partner_number', c.partner_number,
          'trade_name_en', c.trade_name_en, 'trade_name_ar', c.trade_name_ar,
          'units', c.units, 'outstanding', c.outstanding, 'oldest_days', c.oldest_days,
          'days_0_30', c.b1, 'days_31_60', c.b2, 'days_61_90', c.b3, 'days_over_90', c.b4)
          order by c.oldest_days desc nulls last, c.outstanding desc)
        from (select partner_id, pg_catalog.min(partner_number) as partner_number,
                     pg_catalog.min(trade_name_en) as trade_name_en, pg_catalog.min(trade_name_ar) as trade_name_ar,
                     pg_catalog.count(*)::int as units, pg_catalog.sum(outstanding) as outstanding,
                     pg_catalog.max(age_days) as oldest_days,
                     coalesce(pg_catalog.sum(outstanding) filter (where bucket = 'days_0_30'), 0) as b1,
                     coalesce(pg_catalog.sum(outstanding) filter (where bucket = 'days_31_60'), 0) as b2,
                     coalesce(pg_catalog.sum(outstanding) filter (where bucket = 'days_61_90'), 0) as b3,
                     coalesce(pg_catalog.sum(outstanding) filter (where bucket = 'days_over_90'), 0) as b4
              from named group by partner_id) c), '[]'::jsonb),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'source', n.source, 'number', n.number, 'kind', n.kind, 'partner_id', n.partner_id,
          'partner_number', n.partner_number, 'trade_name_en', n.trade_name_en, 'trade_name_ar', n.trade_name_ar,
          'issued_on', n.issued_on, 'due_date', n.due_date, 'outstanding', n.outstanding,
          'age_days', n.age_days, 'bucket', n.bucket, 'deal_type', n.deal_type) order by n.o)
        from named n where n.o <= 500), '[]'::jsonb),
      'truncated', (select pg_catalog.count(*) > 500 from named))
  );
end
$$;
alter function finance.ageing(uuid, boolean) set jit = off;
comment on function finance.ageing(uuid, boolean) is 'Landing 47 (A6): what is still owed and how old it is, by invoice and by organisation — the pursue list for postpaid (postpaid and not-set deal types; every deal type with p_all).';
create function api.finance_ageing(p_partner uuid default null, p_all boolean default false) returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.ageing(p_partner, p_all) $$;

-- ================================================================ A13 — a contract paid in several payments
create function finance.contract_payments(p_contract uuid, p_grain text default 'month') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'view');
  c partner.contract;
  till date;
  ul jsonb;
begin
  if p_grain is null or p_grain not in ('month', 'quarter') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'grain';
  end if;
  select * into c from partner.contract where id = p_contract and deleted_at is null;
  if c.id is null or partner.level_of(me, c.partner_id, c.side) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  till := least(coalesce(c.end_on, core.riyadh_today()), core.riyadh_today());
  if till < c.start_on then
    -- a contract that has not started yet has no payments
    return pg_catalog.jsonb_build_object('contract_id', c.id, 'partner_id', c.partner_id, 'grain', p_grain,
      'from', c.start_on, 'to', till, 'periods', '[]'::jsonb, 'units', 0, 'total', 0, 'not_yet_counted', 0);
  end if;
  ul := finance.unified_ledger_core(c.start_on, till, c.partner_id, null, null, null, null);
  return (
    with docs as (
      select (r ->> 'created_on')::date as day, r ->> 'number' as number, r ->> 'unit_kind' as unit_kind,
             r ->> 'source' as source, (r ->> 'revenue')::numeric as amount, true as counted, null::text as status
      from pg_catalog.jsonb_array_elements(ul -> 'rows') r where coalesce((r ->> 'counted')::boolean, true)
      union all
      select (n ->> 'created_on')::date, n ->> 'number', n ->> 'unit_kind', n ->> 'source',
             (n ->> 'amount')::numeric, false, n ->> 'status'
      from pg_catalog.jsonb_array_elements(ul -> 'not_yet_counted') n
    ),
    periods as (
      select pg_catalog.date_trunc(p_grain, d.day::timestamp)::date as period_start,
             pg_catalog.count(*)::int as units,
             coalesce(pg_catalog.sum(d.amount) filter (where d.counted), 0) as total,
             coalesce(pg_catalog.sum(d.amount) filter (where not d.counted), 0) as not_yet_counted,
             pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('number', d.number, 'unit_kind', d.unit_kind,
               'source', d.source, 'created_on', d.day, 'amount', d.amount, 'counted', d.counted, 'status', d.status)
               order by d.day, d.number) as invoices
      from docs d where d.day is not null
      group by 1
    )
    select pg_catalog.jsonb_build_object(
      'contract_id', c.id, 'partner_id', c.partner_id, 'grain', p_grain, 'from', c.start_on, 'to', till,
      'units', coalesce((select pg_catalog.sum(units)::int from periods), 0),
      'total', coalesce((select pg_catalog.sum(total) from periods), 0),
      'not_yet_counted', coalesce((select pg_catalog.sum(not_yet_counted) from periods), 0),
      'truncated', coalesce((ul ->> 'truncated')::boolean, false),
      'periods', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'period_start', p.period_start, 'units', p.units, 'total', p.total,
          'not_yet_counted', p.not_yet_counted, 'invoices', p.invoices) order by p.period_start)
        from periods p), '[]'::jsonb))
  );
end
$$;
alter function finance.contract_payments(uuid, text) set jit = off;
comment on function finance.contract_payments(uuid, text) is 'Landing 47 (A13): one contract''s payments — the Ledger''s rows of its organisation inside its term, by month or quarter, each period''s total with its invoices under it.';
create function api.finance_contract_payments(p_contract uuid, p_grain text default 'month') returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.contract_payments(p_contract, p_grain) $$;

revoke all on function finance.held_rows(date, date), api.finance_held_rows(date, date),
  finance.reconciliation(date, date), api.finance_reconciliation(date, date),
  finance.ageing(uuid, boolean), api.finance_ageing(uuid, boolean),
  finance.contract_payments(uuid, text), api.finance_contract_payments(uuid, text) from public;
grant execute on function finance.held_rows(date, date), api.finance_held_rows(date, date) to authenticated;
grant execute on function finance.reconciliation(date, date), api.finance_reconciliation(date, date) to authenticated;
grant execute on function finance.ageing(uuid, boolean), api.finance_ageing(uuid, boolean) to authenticated;
grant execute on function finance.contract_payments(uuid, text), api.finance_contract_payments(uuid, text) to authenticated;
