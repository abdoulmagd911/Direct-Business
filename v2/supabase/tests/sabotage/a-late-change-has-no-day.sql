-- Sabotage: a-late-change-has-no-day
-- Breaks: sql:FRD-01
-- Expect: and lists the unit paid after the close, with its riyals and the day it was paid
-- A closed month lists its late changes without the day each happened (the Finance screens brief I.3).
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
                                  'changed_on', null) order by l.ref)
                                from finance.late_change l where l.month = c.month), '[]'::jsonb))
      order by c.month desc)
    from finance.month_close c where c.deleted_at is null), '[]'::jsonb);
end
$$;
