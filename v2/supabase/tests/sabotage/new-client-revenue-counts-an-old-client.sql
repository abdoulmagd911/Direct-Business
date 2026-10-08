-- Sabotage: new-client-revenue-counts-an-old-client
-- Breaks: sql:FMS-01
-- Expect: new client revenue: only an organisation whose first unit falls in the period and has no earlier client-since date
-- New client revenue counts an organisation that already had counted units before the period (section 3.8).
create or replace function measure.finance_new_client_revenue(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                   p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (coalesce(sum(u.revenue), 0), true, pg_catalog.count(*)::int)::measure.result
  from measure.finance_units(p_scope_kind, p_scope_id, p_from, p_to) u
  join partner.partner pa on pa.id = u.partner_id
  where (pa.client_since is null or pa.client_since >= p_from)
$$;
