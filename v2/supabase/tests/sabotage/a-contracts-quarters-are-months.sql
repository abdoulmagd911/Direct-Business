-- Sabotage: a-contracts-quarters-are-months
-- Breaks: sql:CPY-01
-- Expect: by quarter: two quarters
-- Asked by quarter, the payments are still grouped by month.
create or replace function finance.contract_payments(p_contract uuid, p_grain text default 'month') returns jsonb
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
      select pg_catalog.date_trunc('month', d.day::timestamp)::date as period_start,
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
