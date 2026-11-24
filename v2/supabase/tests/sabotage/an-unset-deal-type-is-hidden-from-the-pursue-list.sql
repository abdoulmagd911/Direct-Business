-- Sabotage: an-unset-deal-type-is-hidden-from-the-pursue-list
-- Breaks: sql:AGE-01
-- Expect: a row whose deal type is not set is kept
-- A row whose deal type is not set is left off the postpaid pursue list.
create or replace function finance.ageing(p_partner uuid default null, p_all boolean default false) returns jsonb
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
      where p_all or o.deal_type = 'postpaid'
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
