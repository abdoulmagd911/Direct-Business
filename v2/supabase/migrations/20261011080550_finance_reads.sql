-- v2 finance, part 6 (the Finance screens brief I.3, I.4): the reads the screens draw from, through the Data API (V124).
-- The figures for any period over every paid unit, each with its Provisional part beside it (V611, V621) and every unit
-- saying Final or Provisional; the closed months with their closing day and person, frozen figures and late changes
-- (V610). Each read needs View on Finance; a read that cannot run raises, so a screen never draws a failed read as 0
-- (I.10). Forward-only (V103).

-- A unit's cost as a person reads it: Final when every expense is approved (or none is needed), else Provisional.
create function finance.cost_word(p_status text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select case when p_status = 'provisional' then 'provisional' else 'final' end $$;

-- ================================================================ the period (I.4)
-- The counted units of the months from p_from to p_to (created month, V610): revenue, cost and profit over every paid
-- unit, the Provisional part of each and how many units it is, and the same per month.
create function finance.period_figures(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m0 date := pg_catalog.date_trunc('month', p_from::timestamp)::date;
  m1 date := pg_catalog.date_trunc('month', p_to::timestamp)::date;
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with r as (select * from finance.money_row x where x.counted and x.month_on between m0 and m1)
    select pg_catalog.jsonb_build_object(
      'from', m0, 'to', m1,
      'units', (select pg_catalog.count(*) from r),
      'revenue', (select coalesce(sum(r.revenue), 0) from r),
      'cost', (select coalesce(sum(r.cost), 0) from r),
      'profit', (select coalesce(sum(r.profit), 0) from r),
      'provisional', pg_catalog.jsonb_build_object(
        'units', (select pg_catalog.count(*) from r where r.provisional),
        'revenue', (select coalesce(sum(r.revenue), 0) from r where r.provisional),
        'cost', (select coalesce(sum(r.cost), 0) from r where r.provisional),
        'profit', (select coalesce(sum(r.profit), 0) from r where r.provisional)),
      'losses', (select pg_catalog.count(*) from r where r.loss),
      'months', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) order by m.month_on)
                          from finance.money_month m where m.month_on between m0 and m1), '[]'::jsonb))
  );
end
$$;

-- The units of the period, each with its figures and whether its cost is Final or Provisional; counted or not, and why
-- not (pending, excluded with its reason).
create function finance.period_units(p_from date, p_to date) returns table (
  invoice_id uuid, unit_kind text, ref text, dpin text, month_on date, paid_on date, partner_id uuid, channel text,
  counted boolean, excluded_reason text, revenue numeric, cost numeric, profit numeric, cost_is text, loss boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return query
  select r.invoice_id, r.unit_kind, r.ref, coalesce(t.dpin, tb.dpin), r.month_on, r.paid_on, r.partner_id, r.channel, r.counted,
         r.excluded_reason, r.revenue, r.cost, r.profit, finance.cost_word(r.cost_status), r.loss
  from finance.money_row r
  left join finance.tax_invoice t on t.parent_invoice_id = r.invoice_id and t.deleted_at is null
  left join finance.billing_link bl on bl.transaction_invoice_id = r.invoice_id and bl.deleted_at is null
  left join finance.tax_invoice tb on tb.parent_invoice_id = bl.billing_invoice_id and tb.deleted_at is null
  where r.month_on between pg_catalog.date_trunc('month', p_from::timestamp)::date
                       and pg_catalog.date_trunc('month', p_to::timestamp)::date
  order by r.month_on, r.ref, r.unit_kind;
end
$$;

-- ================================================================ the closed months (I.3)
-- Each closed month: when and by whom, its frozen figures (from the snapshot, never recomputed) and its late changes —
-- each unit paid late, dropped (cancelled after payment) or with its cost changed since, with its riyals.
create function finance.closed_months() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'month', c.month, 'closed_on', c.closed_on, 'closed_by', c.closed_by, 'note', c.note,
      'frozen', (select pg_catalog.jsonb_build_object(
                   'units', pg_catalog.count(*),
                   'revenue', coalesce(sum((e ->> 'revenue')::numeric), 0),
                   'cost', coalesce(sum((e ->> 'cost')::numeric), 0),
                   'profit', coalesce(sum((e ->> 'revenue')::numeric - (e ->> 'cost')::numeric), 0))
                 from pg_catalog.jsonb_array_elements(c.snapshot) e),
      'late_changes', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                  'invoice_id', l.invoice_id, 'ref', l.ref, 'unit_kind', l.unit_kind, 'change', l.change,
                                  'revenue_change', l.revenue_change, 'cost_change', l.cost_change) order by l.ref)
                                from finance.late_change l where l.month = c.month), '[]'::jsonb))
      order by c.month desc)
    from finance.month_close c where c.deleted_at is null), '[]'::jsonb);
end
$$;

-- ================================================================ one search, both numbers (I.5)
-- V617 (3): the transaction number (Payments' reference) and the tax invoice number (DPIN) are two fields, and one
-- search box finds an invoice by either. Each hit carries both numbers apart and says which one matched. Only letters
-- and digits are compared (spaces, dashes and case are ignored, and no sign is a wildcard); an exact number comes
-- first, then one that starts with the text, then the rest, newest first. A transaction billed in a monthly invoice
-- carries that invoice's DPIN, and billing_ref names the monthly invoice.
create function finance.search_numbers(p_text text, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  q text := pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p_text, ''), '[^[:alnum:]]', '', 'g'));
begin
  perform authz.require('finance', 'view');
  if pg_catalog.length(q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'invoice_id', h.id, 'kind', h.kind, 'ref', h.ref, 'dpin', h.dpin, 'billing_ref', h.billing_ref,
             'matched', h.matched,
             'customer_name', h.customer_name, 'created_on', h.created_on, 'paid_on', h.paid_on, 'total_sar', h.total_sar)
           order by h.rank, h.created_on desc, h.ref)
    from (
      select i.id, i.kind, i.ref, coalesce(t.dpin, tb.dpin) as dpin, b.ref as billing_ref, i.customer_name, i.created_on, i.paid_on, i.total_sar,
             case when x.r and x.d then 'both' when x.r then 'ref' else 'dpin' end as matched,
             case when x.rk = q or x.dk = q then 0
                  when pg_catalog.left(x.rk, pg_catalog.length(q)) = q or pg_catalog.left(x.dk, pg_catalog.length(q)) = q then 1
                  else 2 end as rank
      from finance.invoice i
      left join finance.tax_invoice t on t.parent_invoice_id = i.id and t.deleted_at is null
      left join finance.billing_link bl on bl.transaction_invoice_id = i.id and bl.deleted_at is null
      left join finance.invoice b on b.id = bl.billing_invoice_id and b.deleted_at is null
      left join finance.tax_invoice tb on tb.parent_invoice_id = b.id and tb.deleted_at is null
      cross join lateral (
        select pg_catalog.upper(pg_catalog.regexp_replace(i.ref, '[^[:alnum:]]', '', 'g')) as rk,
               pg_catalog.upper(pg_catalog.regexp_replace(coalesce(t.dpin, tb.dpin, ''), '[^[:alnum:]]', '', 'g')) as dk) k
      cross join lateral (
        select k.rk, k.dk, pg_catalog.strpos(k.rk, q) > 0 as r, q <> '' and pg_catalog.strpos(k.dk, q) > 0 as d) x
      where i.deleted_at is null and (x.r or x.d)
      order by rank, i.created_on desc, i.ref
      limit greatest(1, least(coalesce(p_limit, 20), 100))) h), '[]'::jsonb);
end
$$;

-- ================================================================ the doors the Data API reaches (V124)
create function api.finance_period(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.period_figures(p_from, p_to) $$;
create function api.finance_period_units(p_from date, p_to date) returns table (
  invoice_id uuid, unit_kind text, ref text, dpin text, month_on date, paid_on date, partner_id uuid, channel text,
  counted boolean, excluded_reason text, revenue numeric, cost numeric, profit numeric, cost_is text, loss boolean)
language sql stable security invoker set search_path = ''
as $$ select * from finance.period_units(p_from, p_to) $$;
create function api.finance_closed_months() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.closed_months() $$;
create function api.finance_search(p_text text, p_limit int default 20) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.search_numbers(p_text, p_limit) $$;

revoke all on function finance.period_figures(date, date) from public;
revoke all on function finance.period_units(date, date) from public;
revoke all on function finance.closed_months() from public;
revoke all on function finance.search_numbers(text, int) from public;
grant execute on function finance.period_figures(date, date) to authenticated;
grant execute on function finance.period_units(date, date) to authenticated;
grant execute on function finance.closed_months() to authenticated;
grant execute on function finance.search_numbers(text, int) to authenticated;
grant execute on function api.finance_period(date, date) to authenticated;
grant execute on function api.finance_period_units(date, date) to authenticated;
grant execute on function api.finance_closed_months() to authenticated;
grant execute on function api.finance_search(text, int) to authenticated;
