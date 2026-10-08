-- An organisation's money by month and sales by code (spec §3.6 partner_month, sales_by_code; V65, V414, V611).
-- Both read the counted units (money_row), never a copy. partner_month: organisation × month — units, revenue, cost,
-- profit, the Provisional part beside them and the Losses; outstanding joins it when receipts are imported.
-- sales_by_code: discount or campaign code × month — units, revenue, profit, and whom the code belongs to on the
-- unit's created day: an organisation (a discount code on its identifiers), a campaign (credited to no organisation,
-- listed apart — V65), or nobody known; with the fee percent of the terms in force at the month's end.

create view finance.partner_month with (security_invoker = true) as
select r.partner_id, r.month_on, pg_catalog.count(*)::int as units, sum(r.revenue) as revenue, sum(r.cost) as cost,
       sum(r.profit) as profit, (pg_catalog.count(*) filter (where r.provisional))::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       (pg_catalog.count(*) filter (where r.loss))::int as losses
from finance.money_row r
where r.counted and r.partner_id is not null
group by r.partner_id, r.month_on;
comment on view finance.partner_month is 'An organisation × month (§3.6): its counted units'' revenue, cost and profit, the Provisional part beside them and its Losses.';

create view finance.sales_by_code with (security_invoker = true) as
with u as (
  select r.invoice_id, r.month_on, r.created_on, r.revenue, r.profit, i.code_key, i.discount_code_raw
  from finance.money_row r join finance.invoice i on i.id = r.invoice_id
  where r.counted and i.code_key is not null
),
holder as (
  select u.*, d.id as identifier_id, d.partner_id, c.id as campaign_code_id
  from u
  left join partner.identifier d on d.kind = 'discount_code' and d.value_key = u.code_key and d.deleted_at is null
    and (d.valid_from is null or d.valid_from <= u.created_on) and (d.valid_to is null or u.created_on <= d.valid_to)
  left join partner.campaign_code c on c.code_key = u.code_key and c.deleted_at is null
    and (c.valid_from is null or c.valid_from <= u.created_on) and (c.valid_to is null or u.created_on <= c.valid_to)
)
select h.code_key, min(h.discount_code_raw) as code, h.month_on,
       case when h.partner_id is not null then 'partner' when h.campaign_code_id is not null then 'campaign' else 'unknown' end
         as held_by,
       h.partner_id, h.campaign_code_id, pg_catalog.count(*)::int as units, sum(h.revenue) as revenue,
       sum(h.profit) as profit,
       (select t.fee_percent from partner.code_terms t
        where t.deleted_at is null and t.effective_from <= (h.month_on + interval '1 month' - interval '1 day')::date
          and (t.identifier_id = h.identifier_id or t.campaign_code_id = h.campaign_code_id)
        order by t.effective_from desc, t.created_at desc limit 1) as fee_percent
from holder h
group by h.code_key, h.month_on, h.partner_id, h.campaign_code_id, h.identifier_id;
comment on view finance.sales_by_code is 'V65: a discount or campaign code × month — counted units, revenue, profit, whom the code belongs to, and the fee percent in force.';

-- An organisation's months, for its card (Finance view level).
create function finance.partner_months(p_partner uuid, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) - 'partner_id' order by m.month_on)
                   from finance.partner_month m
                   where m.partner_id = p_partner
                     and m.month_on between pg_catalog.date_trunc('month', coalesce(p_from, '2000-01-01')::timestamp)::date
                                        and pg_catalog.date_trunc('month', coalesce(p_to, '2100-12-31')::timestamp)::date),
                  '[]'::jsonb);
end
$$;

-- Sales by code over a period, each code's months with its holder's name.
create function finance.sales_by_code_list(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'code', s.code, 'month', s.month_on, 'held_by', s.held_by, 'partner_id', s.partner_id,
      'partner_name', p.trade_name_en, 'campaign_code_id', s.campaign_code_id, 'campaign_name', c.name,
      'units', s.units, 'revenue', s.revenue, 'profit', s.profit, 'fee_percent', s.fee_percent)
      order by s.month_on, s.code)
    from finance.sales_by_code s
    left join partner.partner p on p.id = s.partner_id
    left join partner.campaign_code c on c.id = s.campaign_code_id
    where s.month_on between pg_catalog.date_trunc('month', p_from::timestamp)::date
                         and pg_catalog.date_trunc('month', p_to::timestamp)::date), '[]'::jsonb);
end
$$;

create function api.finance_partner_months(p_partner uuid, p_from date default null, p_to date default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.partner_months(p_partner, p_from, p_to) $$;
create function api.finance_sales_by_code(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.sales_by_code_list(p_from, p_to) $$;

revoke all on function finance.partner_months(uuid, date, date) from public;
revoke all on function finance.sales_by_code_list(date, date) from public;
grant execute on function finance.partner_months(uuid, date, date) to authenticated;
grant execute on function finance.sales_by_code_list(date, date) to authenticated;
grant execute on function api.finance_partner_months(uuid, date, date) to authenticated;
grant execute on function api.finance_sales_by_code(date, date) to authenticated;
