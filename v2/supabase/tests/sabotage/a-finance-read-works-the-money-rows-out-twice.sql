-- Sabotage: a-finance-read-works-the-money-rows-out-twice
-- Breaks: sql:SPD-01
-- Expect: each Finance read takes the money rows once: none mentions finance.money_row twice
-- The partner tab's not-yet-counted read mentions the money rows twice again, so every invoice is worked out twice.
CREATE OR REPLACE FUNCTION finance.company_not_counted(p_partner uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET jit TO 'off'
AS $function$
begin
  perform authz.require('finance', 'view');
  if p_partner is null or p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with imp as (
      select i.revenue_sar from finance.import_unit i
      where i.eff_partner_id = p_partner and i.fully_paid and i.excluded_mode = 'exclude'
        and i.record_date between p_from and p_to
        and not exists (select 1 from finance.money_row m where (m.counted or m.excluded_by is not null)
                        and m.partner_id = i.partner_id and m.unit_kind = i.mapped_kind and m.ref = i.number)
    )
    select pg_catalog.jsonb_build_object(
      'excluded_units', pg_catalog.count(*) filter (where r.excluded_by is not null) + (select pg_catalog.count(*) from imp),
      'excluded_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is not null), 0)
                          + coalesce((select pg_catalog.sum(revenue_sar) from imp), 0),
      'held_units', pg_catalog.count(*) filter (where r.excluded_by is null and not r.counted),
      'held_revenue', coalesce(pg_catalog.sum(r.revenue) filter (where r.excluded_by is null and not r.counted), 0))
    from finance.money_row r
    where r.partner_id = p_partner
      and r.created_on between p_from and p_to
  );
end
$function$

;
