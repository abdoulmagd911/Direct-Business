-- The Finance measures (TECH-SPEC §3.8 "Measures in v1"; P4-2): finance.revenue, finance.margin and
-- finance.new_client_revenue, each a function measure.finance_<name>(params, scope_kind, scope_id, from, to) answering
-- (value, measured, n) with an _items twin for the drill-down, as the work measures do. A unit belongs to the day it was
-- created (V610) and counts once fully paid; the figures are money_row's, never a copy. Scopes: company and partner
-- read the units; person, team and department read who is credited (credit_row — split, else the account manager on
-- the created day, V613), a person's team and department as they are now. A sum of nothing is a real 0 SAR, so these
-- are always measured. finance.commercial_revenue waits for its setting (finance.revenue_definition, decided at
-- go-live). Forward-only.

-- The counted units (or credited shares) a scope holds in a period, with their revenue and profit.
create function measure.finance_units(p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns table (invoice_id uuid, unit_kind text, person_id uuid, partner_id uuid, created_on date, revenue numeric,
                 profit numeric, cost_final boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  if coalesce(p_scope_kind, 'company') in ('company', 'partner') then
    return query
    select r.invoice_id, r.unit_kind, null::uuid, r.partner_id, r.created_on, r.revenue, r.profit, not r.provisional
    from finance.money_row r
    where r.counted and r.created_on between p_from and p_to
      and measure.in_scope(p_scope_kind, p_scope_id, null, null, null, r.partner_id);
  else
    return query
    select c.invoice_id, c.unit_kind, c.person_id, r.partner_id, r.created_on, c.revenue, c.profit, not r.provisional
    from finance.credit_row c
    join finance.money_row r on r.invoice_id = c.invoice_id and r.unit_kind = c.unit_kind
    left join core.person p on p.id = c.person_id
    where r.counted and r.created_on between p_from and p_to and c.person_id is not null
      and measure.in_scope(p_scope_kind, p_scope_id, c.person_id, p.team_id, p.department_id, r.partner_id);
  end if;
end
$$;

-- ================================================================ revenue
create function measure.finance_revenue_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                              p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, true
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
  order by u.created_on, u.invoice_id
$$;
create function measure.finance_revenue(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.revenue), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
$$;

-- ================================================================ margin
-- The profit (revenue − cost as recorded, negative for a Loss — V414). Each item says whether its cost is final, so the
-- drill-down shows how much of the revenue had a cost (§3.8); n counts the units with a final cost.
create function measure.finance_margin_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                             p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, u.cost_final
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
  order by u.created_on, u.invoice_id
$$;
create function measure.finance_margin(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date, p_to date)
  returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.profit), 0), true, (pg_catalog.count(*) filter (where u.cost_final))::int)::measure.result
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
$$;

-- ================================================================ new client revenue
-- The revenue of organisations whose first counted unit ever falls in the period, unless a typed client-since date is
-- earlier than the period (§3.8).
create function measure.finance_new_client_revenue_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                         p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select 'finance.invoice'::text, u.invoice_id, u.person_id, u.created_on, true
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
  join partner.partner pa on pa.id = u.partner_id
  where (pa.client_since is null or pa.client_since >= p_from)
    and (select min(r.created_on) from finance.money_row r where r.counted and r.partner_id = u.partner_id) >= p_from
  order by u.created_on, u.invoice_id
$$;
create function measure.finance_new_client_revenue(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                   p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.revenue), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
  join partner.partner pa on pa.id = u.partner_id
  where (pa.client_since is null or pa.client_since >= p_from)
    and (select min(r.created_on) from finance.money_row r where r.counted and r.partner_id = u.partner_id) >= p_from
$$;

revoke all on function measure.finance_units(text, uuid, date, date),
  measure.finance_revenue_items(jsonb, text, uuid, date, date), measure.finance_revenue(jsonb, text, uuid, date, date),
  measure.finance_margin_items(jsonb, text, uuid, date, date), measure.finance_margin(jsonb, text, uuid, date, date),
  measure.finance_new_client_revenue_items(jsonb, text, uuid, date, date),
  measure.finance_new_client_revenue(jsonb, text, uuid, date, date) from public;
