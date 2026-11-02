-- Sabotage: a-new-invoices-channel-is-a-second-request
-- Breaks: sql:ROW-05
-- Expect: the invoice and its credit are written by one request
-- A new invoice's channel and credit are saved in a request of their own, so Undo of the new invoice leaves the
-- credit behind (QA-548).
create or replace function finance.row_add(p_table text, p_fields jsonb, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  t text := 'finance.' || p_table;
  vals jsonb := finance.row_values(p_table, p_fields, true);
  cols text;
  rid uuid;
  req uuid;
begin
  if p_table in ('invoice_line', 'expense_line', 'receipt')
     and not exists (select 1 from finance.invoice i where i.id = (vals ->> 'invoice_id')::uuid and i.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'invoice_id';
  end if;
  if p_table = 'invoice_line' and not (vals ? 'line_no') then
    vals := vals || pg_catalog.jsonb_build_object('line_no',
              (select coalesce(max(l.line_no), 0) + 1 from finance.invoice_line l where l.invoice_id = (vals ->> 'invoice_id')::uuid));
  end if;
  if p_table = 'receipt' then
    -- a receipt typed by hand has a key of its own, so no file ever finds it as one of its rows
    vals := vals || pg_catalog.jsonb_build_object('receipt_key', 'person|' || gen_random_uuid()::text);
  end if;
  vals := vals || pg_catalog.jsonb_build_object('created_by', me, 'src', pg_catalog.jsonb_build_object('_row', 'person'))
               || case when p_table in ('invoice', 'expense_line', 'receipt') then '{"source": "manual"}'::jsonb
                       else '{}'::jsonb end;
  select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k) into cols from pg_catalog.jsonb_object_keys(vals) k;
  req := audit.begin('ui', 'finance.row_added', pg_catalog.jsonb_build_object('table', p_table), p_reason);
  execute pg_catalog.format('insert into %1$s (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::%1$s, $1) returning id',
                            pg_catalog.to_regclass(t), cols)
    into rid using vals;
  -- a new invoice's channel and the person it credits, in this same request: one Undo removes all of it (QA-548)
  perform audit.end();
  if p_table = 'invoice' and (p_fields ? 'channel' or p_fields ? 'credit_to') then
    perform audit.begin('ui', 'finance.channel_set', '{}'::jsonb, p_reason);
    perform finance.channel_apply(rid, nullif(pg_catalog.btrim(p_fields ->> 'channel'), ''),
                                  nullif(pg_catalog.btrim(p_fields ->> 'credit_to'), '')::uuid, me);
    perform audit.end();
  end if;
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$$;
