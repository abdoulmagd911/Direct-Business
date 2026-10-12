-- Sabotage: a-tender-is-consumed-by-any-client-id
-- Breaks: sql:TND-01
-- Expect: nothing consumes a tender until it names its client ID
-- Every paid unit of the organisation consumes its tender, whatever client ID it carries (V614).
create or replace view finance.tender_use with (security_invoker = true) as
select t.id as tender_id, t.number, t.title, t.partner_id, t.owner_id, t.signed_on, t.client_identifier_id,
       case when t.signed_on is not null then coalesce(t.awarded_value_sar, t.value_sar) end as signed_value,
       coalesce(c.consumed, 0) as consumed, coalesce(c.units, 0) as units
from pipeline.tender t
left join lateral (
  select sum(r.revenue) as consumed, pg_catalog.count(*)::int as units
  from finance.money_row r
  join finance.invoice i on i.id = r.invoice_id
  join partner.identifier d on d.partner_id = t.partner_id and d.kind = 'payments_client_id' and d.deleted_at is null
    and d.value_key = i.client_id_key
  where r.counted
) c on true
where t.deleted_at is null and t.lost_reason_id is null;
