-- The Finance measures by segment, and the two left (TECH-SPEC §3.8 "Measures in v1"; P4-2; V4, V98, V501).
--  * Every finance measure takes the `segment` parameter — a Client type key (V98): only units of organisations whose
--    Client side is of that type count. No segment, every unit.
--  * finance.commercial_revenue reads the setting finance.revenue_definition as of each unit's month (V4): its basis
--    (revenue, the default, or margin), which services (none named: all), which client types (none named: all) and
--    whether a commission invoice counts — it does by default (V501). A changed definition recalculates every figure
--    that reads the measure, month by month.
--  * finance.collected is what was received: the receipts allocated to the scope's invoices, by the day they were paid
--    (a person, team or department: the client's account manager on that day).
-- Forward-only.

-- The counted units (or credited shares) a scope holds in a period, in a segment, with what the measures read: the
-- unit's revenue and profit (a person's credited share of them), its month, whether it is a commission, and the share.
create function measure.finance_scope_units(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns table (invoice_id uuid, unit_kind text, person_id uuid, partner_id uuid, created_on date, month_on date,
                 revenue numeric, profit numeric, cost_final boolean, commission boolean, share numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  if coalesce(p_scope_kind, 'company') in ('company', 'partner') then
    return query
    select r.invoice_id, r.unit_kind, null::uuid, r.partner_id, r.created_on, r.month_on, r.revenue, r.profit,
           not r.provisional, r.commission, 1::numeric
    from finance.money_row r
    where r.counted and r.created_on between p_from and p_to
      and measure.in_scope(p_scope_kind, p_scope_id, null, null, null, r.partner_id)
      and (seg is null or measure.client_segment(r.partner_id) = seg);
  else
    return query
    select c.invoice_id, c.unit_kind, c.person_id, r.partner_id, r.created_on, r.month_on, c.revenue, c.profit,
           not r.provisional, r.commission, case when r.revenue = 0 then 0 else c.revenue / r.revenue end
    from finance.credit_row c
    join finance.money_row r on r.invoice_id = c.invoice_id and r.unit_kind = c.unit_kind
    left join core.person p on p.id = c.person_id
    where r.counted and r.created_on between p_from and p_to and c.person_id is not null
      and measure.in_scope(p_scope_kind, p_scope_id, c.person_id, p.team_id, p.department_id, r.partner_id)
      and (seg is null or measure.client_segment(r.partner_id) = seg);
  end if;
end
$$;

-- ================================================================ revenue, margin, new client revenue — by segment
create or replace function measure.finance_revenue_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                         p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, true
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
  order by u.created_on, u.invoice_id
$$;
create or replace function measure.finance_revenue(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                   p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.revenue), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
$$;
create or replace function measure.finance_margin_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                        p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, u.cost_final
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
  order by u.created_on, u.invoice_id
$$;
create or replace function measure.finance_margin(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                  p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.profit), 0), true, (pg_catalog.count(*) filter (where u.cost_final))::int)::measure.result
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
$$;
create or replace function measure.finance_new_client_revenue_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                                    p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, true
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
  join partner.partner pa on pa.id = u.partner_id
  where (pa.client_since is null or pa.client_since >= p_from)
    and (select min(r.created_on) from finance.money_row r where r.counted and r.partner_id = u.partner_id) >= p_from
  order by u.created_on, u.invoice_id
$$;
create or replace function measure.finance_new_client_revenue(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                              p_from date, p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.revenue), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
  join partner.partner pa on pa.id = u.partner_id
  where (pa.client_since is null or pa.client_since >= p_from)
    and (select min(r.created_on) from finance.money_row r where r.counted and r.partner_id = u.partner_id) >= p_from
$$;

-- ================================================================ commercial revenue (V4, V501)
-- What one unit (or a person's share of it) adds to "Commercial revenue" under the definition in force in its month;
-- null where the definition leaves it out.
create function measure.finance_commercial_part(p_invoice uuid, p_unit_kind text, p_partner uuid, p_month date,
                                                p_revenue numeric, p_profit numeric, p_commission boolean,
                                                p_share numeric) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  d jsonb := coalesce(core.setting_at('finance.revenue_definition', null, p_month), '{}'::jsonb);
  margin boolean := coalesce(d ->> 'basis', 'revenue') = 'margin';
  services text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(d -> 'services', '[]'::jsonb)));
  types text[] := array(select pg_catalog.jsonb_array_elements_text(coalesce(d -> 'client_types', '[]'::jsonb)));
begin
  if p_commission and not coalesce((d ->> 'commissions')::boolean, true) then
    return null;
  end if;
  if pg_catalog.cardinality(types) > 0
     and not exists (select 1 from partner.side_type t
                     where t.id = measure.client_segment(p_partner) and t.key = any (types)) then
    return null;
  end if;
  if pg_catalog.cardinality(services) = 0 then
    return case when margin then p_profit else p_revenue end;
  end if;
  return (select coalesce(sum(case when margin then s.revenue - s.cost else s.revenue end), 0) * p_share
          from finance.money_service_row s join finance.service v on v.id = s.service_id
          where s.invoice_id = p_invoice and s.unit_kind = p_unit_kind and s.part = 'service' and v.key = any (services));
end
$$;

create function measure.finance_commercial_revenue_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                         p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, true
  from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u
  where measure.finance_commercial_part(u.invoice_id, u.unit_kind, u.partner_id, u.month_on, u.revenue, u.profit,
                                        u.commission, u.share) is not null
  order by u.created_on, u.invoice_id
$$;
create function measure.finance_commercial_revenue(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                   p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(x.part), 0), true, (pg_catalog.count(*) filter (where x.part is not null))::int)::measure.result
  from (select measure.finance_commercial_part(u.invoice_id, u.unit_kind, u.partner_id, u.month_on, u.revenue,
                                               u.profit, u.commission, u.share) as part
        from measure.finance_scope_units(p_params, p_scope_kind, p_scope_id, p_from, p_to) u) x
$$;

-- ================================================================ collected
-- The receipts allocated to the scope's invoices, by the day paid; a person, team or department holds the receipts of
-- the clients they managed that day. A receipt on a removed or excluded invoice is not counted.
create function measure.finance_receipts(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns table (receipt_id uuid, person_id uuid, paid_on date, amount numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select c.id, o.person_id, c.paid_on, c.amount_sar
  from finance.receipt c
  join finance.invoice_fact f on f.id = c.invoice_id
  left join lateral (select x.person_id from partner.side_owner x
                     where x.partner_id = f.partner_id and x.side = 'client' and x.deleted_at is null
                       and x.effective_from <= c.paid_on and (x.effective_to is null or c.paid_on < x.effective_to)
                     order by x.effective_from desc limit 1) o on true
  left join core.person p on p.id = o.person_id
  where c.deleted_at is null and c.paid_on between p_from and p_to
    and not exists (select 1 from finance.exclusion_of(c.invoice_id) e where e.id is not null)
    and (seg is null or measure.client_segment(f.partner_id) = seg)
    and (coalesce(p_scope_kind, 'company') in ('company', 'partner') or o.person_id is not null)
    and measure.in_scope(p_scope_kind, p_scope_id, o.person_id, p.team_id, p.department_id, f.partner_id);
end
$$;
create function measure.finance_collected_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.receipt'::text, r.receipt_id, r.person_id, r.paid_on, true
  from measure.finance_receipts(p_params, p_scope_kind, p_scope_id, p_from, p_to) r
  order by r.paid_on, r.receipt_id
$$;
create function measure.finance_collected(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(r.amount), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.finance_receipts(p_params, p_scope_kind, p_scope_id, p_from, p_to) r
$$;

revoke all on function measure.finance_scope_units(jsonb, text, uuid, date, date),
  measure.finance_commercial_part(uuid, text, uuid, date, numeric, numeric, boolean, numeric),
  measure.finance_commercial_revenue_items(jsonb, text, uuid, date, date),
  measure.finance_commercial_revenue(jsonb, text, uuid, date, date),
  measure.finance_receipts(jsonb, text, uuid, date, date),
  measure.finance_collected_items(jsonb, text, uuid, date, date),
  measure.finance_collected(jsonb, text, uuid, date, date) from public;
