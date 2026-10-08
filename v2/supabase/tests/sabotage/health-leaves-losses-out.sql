-- Sabotage: health-leaves-losses-out
-- Breaks: sql:HLT-01
-- Expect: health lists what is held back or doubtful, each with its riyals; a Loss is counted; nothing at zero is listed
-- Finance health no longer counts the units whose cost is above their revenue (V414).
create or replace function finance.health(p_from date default null, p_to date default null) returns jsonb
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
      select 'losses', pg_catalog.count(*)::int, sum(u.profit) from u where u.counted and u.loss and u.profit > 0
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
