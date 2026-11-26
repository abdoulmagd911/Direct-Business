-- Sabotage: a-new-invoice-is-not-asked-whose-it-is
-- Breaks: sql:OWN-02
-- Expect: a team member types no invoice for a colleague's client
-- A new invoice is kept without asking whose client it is.
CREATE OR REPLACE FUNCTION finance.row_add(p_table text, p_fields jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
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
  -- Landing 56: a line, an expense or a receipt goes on an invoice of the writer's own client (or the writer holds Full).
  if p_table in ('invoice_line', 'expense_line', 'receipt') then
    perform finance.require_own('invoice', array[(vals ->> 'invoice_id')::uuid]);
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
  -- Landing 56: a new invoice is the writer's own client's (or the writer holds Full) — else nothing of it is kept.
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$function$;
