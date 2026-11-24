-- Sabotage: a-row-with-no-organisation-is-not-held
-- Breaks: sql:HLD-01
-- Expect: a row that matches no organisation is held, and says why
-- A row that matches no organisation is left off the held list.
create or replace function finance.held_rows(p_from date, p_to date) returns jsonb
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
      select 'no_organisation'::text as reason, e.* from every e where false
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
