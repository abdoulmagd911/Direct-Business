-- Sabotage: a-small-gap-is-called-a-failure
-- Breaks: sql:RCN-01
-- Expect: but under 1 SAR it is not a failure
-- Every row gap is marked as a failure, whatever its size.
create or replace function finance.reconciliation(p_from date, p_to date) returns jsonb
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
             'failing', true)
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
