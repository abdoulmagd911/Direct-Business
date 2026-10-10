-- Sabotage: an-applied-tender-shows-money
-- Breaks: sql:TND-01
-- Expect: a tender only Applied shows no money
-- A tender only Applied shows money, as if it had been signed (V614).
create or replace function finance.tenders(p_partner uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', u.tender_id, 'number', u.number, 'title', u.title, 'partner_id', u.partner_id,
      'state', case when u.signed_on is null then 'applied' else 'signed' end,
      'signed_on', u.signed_on, 'client_id_named', u.client_identifier_id is not null,
      'signed_value', u.signed_value,
      'consumed', u.consumed,
      'left', greatest(coalesce(u.signed_value, 0) - u.consumed, 0),
      'over', case when u.signed_on is not null then greatest(u.consumed - u.signed_value, 0) end,
      'units', case when u.signed_on is not null then u.units end,
      'units_over', case when u.signed_on is not null then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('invoice_id', x.invoice_id, 'ref', x.ref,
                                                                  'created_on', x.created_on, 'revenue', x.revenue)
                                    order by x.created_on, x.ref)
        from finance.tender_units(u.tender_id) x where x.running > u.signed_value), '[]'::jsonb) end)
      order by u.signed_on desc nulls last, u.number)
    from finance.tender_use u
    where p_partner is null or u.partner_id = p_partner), '[]'::jsonb);
end
$$;
