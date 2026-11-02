-- V629: revenue that never reaches Direct Payments — supplier-wallet commissions and some individual sales — entered by
-- hand, tagged, and counted like the rest (an exception to V612's "no manual ledger now"; D6 stands: Payments is the
-- source of real money).
--  * A manual row is an invoice whose revenue source is `manual` (every other row's is `payments`), with an external
--    reference — the commission ID or code — required and one row per reference, and the day the supplier confirmed it,
--    required, never in the future. It counts on that day, in that day's month, even while the money is still in the
--    supplier's wallet; a row dated into a closed month never changes it and is listed as a late change (V620).
--  * Any Commercial member — Own on Finance and above — enters a row (api.finance_manual_revenue_add); managers and Full
--    on Finance correct and remove it through the row doors (V622), each logged with one Undo; removing archives it.
--  * Its cost is optional. An empty cost stays empty — never 0 — adds nothing to Cost, and leaves the row's profit
--    Provisional until a cost is typed (V611 (2), V458).
--  * Confirmed and Paid out: a person with Full on Finance records the day the money left the supplier's wallet
--    (api.finance_manual_paid_out); it never moves the row's month. Finance → "Confirmed, not paid out" lists the rows
--    still in the wallet with their count, total and the oldest one's age (api.finance_manual_not_paid_out).
--  * Every money row says where it came from (money_row.revenue_source), so any view or total can take or leave the
--    manual rows.
-- Forward-only.

alter table finance.invoice
  add column revenue_source text not null default 'payments' check (revenue_source in ('payments', 'manual')),
  add column external_ref text check (external_ref is null or (pg_catalog.btrim(external_ref) <> ''
                                                                and pg_catalog.length(external_ref) <= 120)),
  add column confirmed_on date,
  add column paid_out_on date,
  add constraint invoice_manual_has_reference check (revenue_source = 'payments'
                                                     or (external_ref is not null and confirmed_on is not null)),
  add constraint invoice_paid_out_after_confirmed check (paid_out_on is null or paid_out_on >= confirmed_on);
create unique index invoice_manual_reference on finance.invoice (norm.fold(external_ref))
  where revenue_source = 'manual' and deleted_at is null;
comment on column finance.invoice.revenue_source is 'V629: payments (every Payments invoice, imported or typed) or manual (revenue that never reaches Payments, entered by hand).';
comment on column finance.invoice.external_ref is 'V629: a manual row''s commission ID or code — required, one row per reference.';
comment on column finance.invoice.confirmed_on is 'V629: the day the supplier confirmed a manual row; it counts that day, in that month.';
comment on column finance.invoice.paid_out_on is 'V629: the day the money left the supplier''s wallet to Direct; never moves the row''s month.';

-- ================================================================ entering a row
create function finance.manual_revenue_add(p_fields jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'own');
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

-- ================================================================ paid out
create function finance.manual_paid_out(p_id uuid, p_on date, p_version int, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  cur finance.invoice;
  req uuid;
begin
  select * into cur from finance.invoice i where i.id = p_id and i.deleted_at is null and i.revenue_source = 'manual'
  for update;
  if cur.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_on is not null and (p_on > core.riyadh_today() or p_on < cur.confirmed_on) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'paid_out_on';
  end if;
  if cur.paid_out_on is not distinct from p_on then
    return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version, 'request_id', null);
  end if;
  perform core.check_version('finance.invoice', cur.id, p_version, array['paid_out_on']);
  req := audit.begin('ui', 'finance.manual_paid_out', pg_catalog.jsonb_build_object('reference', cur.external_ref,
                                                                                    'on', p_on), p_reason);
  perform audit.write_fields('finance.invoice', cur.id, pg_catalog.jsonb_build_object('paid_out_on', p_on));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version + 1, 'request_id', req);
end
$$;

-- ================================================================ confirmed, not paid out
create function finance.manual_not_paid_out() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return (
    select pg_catalog.jsonb_build_object(
             'count', pg_catalog.count(*), 'total_sar', coalesce(sum(i.total_sar), 0),
             'oldest_on', min(i.confirmed_on), 'oldest_days', core.riyadh_today() - min(i.confirmed_on),
             'rows', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                       'invoice_id', i.id, 'reference', i.external_ref, 'customer_name', i.customer_name,
                       'confirmed_on', i.confirmed_on, 'total_sar', i.total_sar, 'version', i.version)
                     order by i.confirmed_on, i.external_ref), '[]'::jsonb))
    from finance.invoice i
    where i.revenue_source = 'manual' and i.deleted_at is null and i.paid_out_on is null
      and not exists (select 1 from finance.exclusion_of(i.id) e where e.id is not null));
end
$$;

create function api.finance_manual_revenue_add(p_fields jsonb, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.manual_revenue_add(p_fields, p_reason) $$;
create function api.finance_manual_paid_out(p_id uuid, p_on date, p_version int, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.manual_paid_out(p_id, p_on, p_version, p_reason) $$;
create function api.finance_manual_not_paid_out() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.manual_not_paid_out() $$;

revoke all on function finance.manual_revenue_add(jsonb, text), finance.manual_paid_out(uuid, date, int, text),
  finance.manual_not_paid_out(), api.finance_manual_revenue_add(jsonb, text),
  api.finance_manual_paid_out(uuid, date, int, text), api.finance_manual_not_paid_out() from public;
grant execute on function finance.manual_revenue_add(jsonb, text), finance.manual_paid_out(uuid, date, int, text),
  finance.manual_not_paid_out(), api.finance_manual_revenue_add(jsonb, text),
  api.finance_manual_paid_out(uuid, date, int, text), api.finance_manual_not_paid_out() to authenticated;
