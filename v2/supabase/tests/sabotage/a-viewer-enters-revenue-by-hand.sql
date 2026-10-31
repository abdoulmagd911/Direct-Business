-- Sabotage: a-viewer-enters-revenue-by-hand
-- Breaks: sql:MAN-01
-- Expect: a viewer enters nothing
-- View on Finance is enough to enter revenue by hand, where V629 asks for a Commercial member (Own).
create or replace function finance.manual_revenue_add(p_fields jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'view');
  allowed text[] := array['external_ref', 'confirmed_on', 'total_sar', 'customer_name', 'client_id', 'discount_code',
                          'product', 'name', 'cost_sar'];
  ref_ text := nullif(pg_catalog.btrim(p_fields ->> 'external_ref'), '');
  confirmed date;
  total numeric;
  cost numeric;
  paid finance.status_map;
  inv uuid;
  req uuid;
begin
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'object'
     or exists (select 1 from pg_catalog.jsonb_object_keys(p_fields) k where k <> all (allowed)) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
  end if;
  if ref_ is null then
    raise exception using errcode = 'P0001', message = 'finance.manual_reference_required';
  end if;
  begin
    confirmed := finance.row_date(p_fields, 'confirmed_on');
    total := (p_fields ->> 'total_sar')::numeric(14, 2);
    cost := (p_fields ->> 'cost_sar')::numeric(14, 2);
  -- a day that is not ISO, or an amount that is not a number: refused, never guessed
  exception when sqlstate 'P0001' or invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'confirmed_on, total_sar or cost_sar';
  end;
  if confirmed is null then
    raise exception using errcode = 'P0001', message = 'finance.manual_confirmed_required';
  end if;
  if confirmed > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'finance.date_in_future', detail = confirmed::text;
  end if;
  if total is null or total <= 0 or (cost is not null and cost < 0) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'total_sar';
  end if;
  if exists (select 1 from finance.invoice i where i.revenue_source = 'manual' and i.deleted_at is null
             and norm.fold(i.external_ref) = norm.fold(ref_)) then
    raise exception using errcode = '23505', message = 'finance.manual_reference_taken', detail = ref_;
  end if;
  select * into paid from finance.status_map s where s.key = 'fully_paid';
  req := audit.begin('ui', 'finance.manual_revenue_added', pg_catalog.jsonb_build_object('reference', ref_, 'total', total),
                     p_reason);
  insert into finance.invoice (ref, kind, customer_name, client_id_raw, discount_code_raw, status_raw, status_id,
                               created_on, paid_on, total_sar, product_raw, product_id, source, src, revenue_source,
                               external_ref, confirmed_on, created_by)
  values ('MAN-' || pg_catalog.left(pg_catalog.upper(pg_catalog.regexp_replace(ref_, '[^[:alnum:]]', '', 'g')), 50),
          'transaction', p_fields ->> 'customer_name', p_fields ->> 'client_id', p_fields ->> 'discount_code',
          paid.word, paid.id, confirmed, confirmed, total, p_fields ->> 'product', finance.product_of(p_fields ->> 'product'),
          'manual', '{"_row": "person"}', 'manual', ref_, confirmed, me)
  returning id into inv;
  -- one line, so income by service places it (D24)
  insert into finance.invoice_line (invoice_id, line_no, product_raw, product_id, name, qty, discount_sar, taxable,
                                    total_sar, service_id, src, created_by)
  values (inv, 1, p_fields ->> 'product', finance.product_of(p_fields ->> 'product'),
          coalesce(nullif(pg_catalog.btrim(p_fields ->> 'name'), ''), p_fields ->> 'product', ref_), 1, 0, true, total,
          (select p.service_id from finance.product p where p.id = finance.product_of(p_fields ->> 'product')),
          '{"_row": "person"}', me);
  -- a cost typed with it is an approved expense; none typed stays empty
  if cost is not null then
    insert into finance.expense_line (invoice_id, line_key, expense_type, status, amount_sar, source, src, created_by)
    values (inv, 'person|' || gen_random_uuid()::text, 'Cost', 'approved', cost, 'manual', '{"_row": "person"}', me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', inv, 'request_id', req);
end
$$;
