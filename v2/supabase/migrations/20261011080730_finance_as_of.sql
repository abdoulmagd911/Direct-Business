-- The Payments "as of" day and the day of each late change (the Finance screens brief, I.4 and I.3; V500, V401, V610).
-- Every Finance screen with figures carries one "Payments · as of" stamp: `api.finance_payments_as_of()` gives the day
-- each Payments export was last read (the newest export time of its imports, Riyadh day) and the stamp itself — the
-- oldest of those days, so a screen never claims its figures are fresher than the oldest file behind them; none when no
-- file has been read. A closed month's late changes carry their day beside their riyals. Forward-only.

create function finance.payments_as_of() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  files jsonb;
begin
  perform authz.require('finance', 'view');
  select coalesce(pg_catalog.jsonb_object_agg(b.file, b.day), '{}'::jsonb) into files
  from (select x.file, (pg_catalog.max(x.export_time) at time zone 'Asia/Riyadh')::date as day
        from finance.import_batch x group by x.file) b;
  return pg_catalog.jsonb_build_object(
    'as_of', (select pg_catalog.min(v.value::text::date) from pg_catalog.jsonb_each(files) v),
    'files', files);
end
$$;
comment on function finance.payments_as_of() is 'Brief I.4 (V500): the day each Payments export was last read, and the "as of" stamp — the oldest of them.';

create function api.finance_payments_as_of() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.payments_as_of() $$;

revoke all on function finance.payments_as_of() from public;
grant execute on function finance.payments_as_of() to authenticated;
revoke all on function api.finance_payments_as_of() from public;
grant execute on function api.finance_payments_as_of() to authenticated;

-- ================================================================ the day of each late change (I.3)
create or replace view finance.late_change with (security_invoker = true) as
with snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost
  from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
  where c.deleted_at is null
), now_counted as (
  select r.month_on as month, r.invoice_id, r.unit_kind, r.ref, r.revenue, r.cost from finance.money_row r
  where r.counted and r.month_on in (select c.month from finance.month_close c where c.deleted_at is null)
)
select coalesce(n.month, s.month) as month, coalesce(n.invoice_id, s.invoice_id) as invoice_id,
       coalesce(n.unit_kind, s.unit_kind) as unit_kind, coalesce(n.ref, s.ref) as ref,
       case when s.invoice_id is null then 'late_paid' when n.invoice_id is null then 'dropped' else 'cost_changed' end as change,
       coalesce(n.revenue, 0) - coalesce(s.revenue, 0) as revenue_change,
       coalesce(n.cost, 0) - coalesce(s.cost, 0) as cost_change,
       -- the day of the change: a late payment's paid day; a drop's last change to the invoice; a cost change's last
       -- change to the invoice's expenses
       case when s.invoice_id is null then i.paid_on
            when n.invoice_id is null then (coalesce(i.updated_at, i.created_at) at time zone 'Asia/Riyadh')::date
            else (select (pg_catalog.max(coalesce(e.updated_at, e.created_at)) at time zone 'Asia/Riyadh')::date
                  from finance.expense_line e where e.invoice_id = i.id) end as changed_on
from now_counted n
full join snap s on s.month = n.month and s.invoice_id = n.invoice_id and s.unit_kind = n.unit_kind
left join finance.invoice i on i.id = coalesce(n.invoice_id, s.invoice_id)
where s.invoice_id is null or n.invoice_id is null or s.cost is distinct from n.cost;

create or replace function finance.closed_months() returns jsonb
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
                                  'revenue_change', l.revenue_change, 'cost_change', l.cost_change,
                                  'changed_on', l.changed_on) order by l.ref)
                                from finance.late_change l where l.month = c.month), '[]'::jsonb))
      order by c.month desc)
    from finance.month_close c where c.deleted_at is null), '[]'::jsonb);
end
$$;
