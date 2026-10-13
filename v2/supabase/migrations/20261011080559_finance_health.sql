-- Finance health and Not yet invoiced (spec §3.6; M48, M52, V414, V420, V424). Health lists what is held back or
-- doubtful, by reason, each with how many and the riyals at stake, so nothing is dropped quietly: rows the latest import
-- held (the exports are cumulative, so the latest file is the current word), expenses waiting for an invoice that has
-- since arrived ("drop the cost export again"), excluded and hidden rows, units with no organisation, an unknown client
-- ID or a match conflict, Provisional units, Losses, failed checks, open import differences and billing proposals.
-- Not yet invoiced is the Overview line "Ready / Pending": units not yet paid, never in revenue (V418).

-- A riyal figure an import row carried, when it is readable; else none (never 0).
create function finance.raw_amount(p_raw jsonb) returns numeric
language sql immutable set search_path = ''
as $$
  select case when x ~ '^-?[0-9]+(\.[0-9]+)?$' then x::numeric end
  from (select pg_catalog.btrim(coalesce(p_raw ->> 'total_sar', p_raw ->> 'amount_sar', ''))) t(x)
$$;

create function finance.health(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', coalesce(p_from, '2000-01-01')::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', coalesce(p_to, '2100-12-31')::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  if m1 < m0 then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with latest as (
      select distinct on (b.file) b.id, b.file from finance.import_batch b order by b.file, b.export_time desc, b.created_at desc
    ),
    held as (
      select h.reason_key, l.file, h.ref, finance.raw_amount(h.raw) as amount
      from finance.import_held h join latest l on l.id = h.batch_id
      where not h.written
    ),
    u as (select * from finance.money_row r where r.month_on between m0 and m1),
    items as (
      select 'held_' || h.file || '_' || h.reason_key as key, pg_catalog.count(*)::int as n, sum(h.amount) as amount
      from held h where not (h.file = 'expenses' and h.reason_key = 'no_invoice')
      group by h.file, h.reason_key
      union all
      select 'drop_cost_export_again', pg_catalog.count(distinct h.ref)::int, sum(h.amount)
      from held h
      where h.file = 'expenses' and h.reason_key = 'no_invoice'
        and exists (select 1 from finance.invoice i where i.ref = h.ref and i.deleted_at is null)
      union all
      select 'excluded', pg_catalog.count(*)::int, sum(u.revenue) from u where u.excluded_by is not null and u.paid
      union all
      select 'hidden', pg_catalog.count(*)::int, sum(i.total_sar)
      from finance.invoice i cross join lateral finance.exclusion_of(i.id) x
      where i.deleted_at is null and x.mode = 'hide' and i.month_on between m0 and m1
      union all
      select 'no_organisation', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.match_state = 'none'
      union all
      select 'unknown_client_id', pg_catalog.count(*)::int, sum(u.revenue)
      from u where u.counted and u.match_state = 'unknown_client_id'
      union all
      select 'match_conflict', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.match_state = 'conflict'
      union all
      select 'provisional', pg_catalog.count(*)::int, sum(u.revenue) from u where u.counted and u.provisional
      union all
      select 'losses', pg_catalog.count(*)::int, sum(u.profit) from u where u.counted and u.loss
      union all
      select 'checks_failed', pg_catalog.count(*)::int, sum(pg_catalog.abs(c.amount_sar))
      from finance.check c join finance.invoice i on i.id = c.invoice_id
      where not c.ok and i.month_on between m0 and m1
      union all
      select 'differences_open', pg_catalog.count(*)::int, null::numeric
      from finance.import_difference d where d.state = 'open' and d.deleted_at is null
      union all
      select 'proposals_open', pg_catalog.count(*)::int, null::numeric
      from finance.billing_proposal p where p.state = 'open' and p.deleted_at is null
    )
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', i.key, 'count', i.n, 'amount_sar', i.amount)
                                         order by i.key) filter (where i.n > 0), '[]'::jsonb)
    from items i
  );
end
$$;

-- V424: Not yet invoiced — units not yet paid: Ready (the status maps to draft) and Pending (maps to pending), with
-- their riyals; never part of revenue. Excluded rows are not here.
create function finance.not_invoiced(p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', coalesce(p_from, '2000-01-01')::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', coalesce(p_to, '2100-12-31')::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  return (
    select pg_catalog.jsonb_build_object(
      'ready', pg_catalog.jsonb_build_object('units', pg_catalog.count(*) filter (where r.pay_state = 'draft'),
                                             'amount_sar', coalesce(sum(r.revenue) filter (where r.pay_state = 'draft'), 0)),
      'pending', pg_catalog.jsonb_build_object('units', pg_catalog.count(*) filter (where r.pay_state = 'pending'),
                                               'amount_sar', coalesce(sum(r.revenue) filter (where r.pay_state = 'pending'), 0)))
    from finance.money_row r
    where not r.paid and r.excluded_by is null and r.month_on between m0 and m1
  );
end
$$;

create function api.finance_health(p_from date default null, p_to date default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.health(p_from, p_to) $$;
create function api.finance_not_invoiced(p_from date default null, p_to date default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.not_invoiced(p_from, p_to) $$;

revoke all on function finance.health(date, date) from public;
revoke all on function finance.not_invoiced(date, date) from public;
grant execute on function finance.health(date, date) to authenticated;
grant execute on function finance.not_invoiced(date, date) to authenticated;
grant execute on function api.finance_health(date, date) to authenticated;
grant execute on function api.finance_not_invoiced(date, date) to authenticated;
