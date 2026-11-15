-- Landing 25 (F-A, A1) — the company Finance tab reads the unified ledger.
--
-- The tab's list and totals now come from finance.unified_ledger filtered to the one company, the same read the
-- Finance page uses, so the two agree by construction. The tab's read path is therefore the ledger, the unified
-- ledger that wraps it, and the period figures the Overview tiles use — and the JIT cost of that read is
-- load-bearing: like partner.company_summary (JIT-01/JIT-02), the RETURN query is above the JIT threshold on a
-- database with data, so Postgres would JIT-compile its expressions (seconds locally, far longer on the Nano) while
-- the execution itself is milliseconds. jit = off is set on all three functions. No signature changes, no grants
-- changes, no type changes for these three — a config-only change.
--
-- finance.company_not_counted: the rows that do not count for one company in a period, so the tab can say
-- "Not yet counted" with the reason instead of leaving a silent gap. Excluded rows are invisible to the ledger
-- by design (money_row: "A hidden row is not here at all; an excluded one is here, not counted, with its rule's
-- reason"), so this is the only read that sees them; a 'hide' rule's rows are invisible everywhere by design and
-- are not counted here either. Held rows are the other side of the same gap: recorded for the company but not
-- paid yet (money_row.counted is false and no rule excludes them), so the Ledger — which counts fully-paid rows
-- only — leaves them out. The not-fully-paid imports are the third reason and need no read of their own: the
-- ledger already answers them as unconfirmed_import_units. The period filter matches the ledger's exactly
-- (created_on between p_from and p_to).

-- (1) jit = off on the tab's read path (config only; no signature, grant or type change)
alter function finance.unified_ledger(date, date, uuid, text, text, text, text) set jit = off;
alter function finance.ledger(date, date, uuid, text, text, text, text) set jit = off;
alter function finance.period_figures(date, date) set jit = off;

-- (2) the not-yet-counted read: excluded rows for one company in a period
create function finance.company_not_counted(p_partner uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_partner is null or p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    select pg_catalog.jsonb_build_object(
      'excluded_units', pg_catalog.count(*) filter (where r.excluded_by is not null),
      'excluded_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is not null), 0),
      'held_units', pg_catalog.count(*) filter (where r.excluded_by is null and not r.counted),
      'held_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is null and not r.counted), 0))
    from finance.money_row r
    where r.partner_id = p_partner
      and r.created_on between p_from and p_to
  );
end
$$;

create function api.finance_company_not_counted(p_partner uuid, p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.company_not_counted(p_partner, p_from, p_to) $$;

revoke all on function finance.company_not_counted(uuid, date, date) from public;
revoke all on function api.finance_company_not_counted(uuid, date, date) from public;
grant execute on function finance.company_not_counted(uuid, date, date) to authenticated;
grant execute on function api.finance_company_not_counted(uuid, date, date) to authenticated;
