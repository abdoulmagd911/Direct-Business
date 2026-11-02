-- QA-548 (Architect's ruling on #211): New invoice saves its channel and the person it credits with the invoice — one
-- request, so one Undo removes the invoice, its channel and its credit together. finance_row_add takes 'channel' (a
-- key) and 'credit_to' (a person) on a new invoice; the channel rule moves into finance.channel_apply, which
-- finance_channel_set calls too, and finance_channel_set now returns its request id for Undo. Forward-only.

-- QA-548: the channel rule in one place — a channel only on a unit (a transaction or a standalone invoice), a channel
-- that credits the owner names the person on an individual's unit, and the person is active staff; then the channel is set
-- and the one-share split written or taken back. The caller holds the request (channel_set, or row_add for a new
-- invoice), so one Undo takes it back with the rest.
create function finance.channel_apply(p_invoice uuid, p_channel text, p_person uuid, p_me uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := p_me;
  inv finance.invoice;
  ch finance.channel;
  org uuid;
begin
  select * into inv from finance.invoice i where i.id = p_invoice and i.deleted_at is null for update;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if inv.kind not in ('transaction', 'standalone') then
    raise exception using errcode = 'P0001', message = 'finance.channel_on_units_only', detail = inv.kind;
  end if;
  if p_channel is not null then
    select * into ch from finance.channel c where c.key = p_channel and c.deleted_at is null and c.active;
    if ch.id is null then
      raise exception using errcode = 'P0002', message = 'finance.unknown_entry', detail = p_channel;
    end if;
  end if;
  select m.partner_id into org from finance.partner_match(inv.id) m;
  if coalesce(ch.credits_owner, false) and org is null and p_person is null then
    raise exception using errcode = 'P0001', message = 'finance.commercial_names_the_person';
  end if;
  if p_person is not null
     and not exists (select 1 from core.person x where x.id = p_person and x.active and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'person.not_active';
  end if;
  update finance.invoice i set channel_id = ch.id, updated_at = pg_catalog.now(), updated_by = me, version = i.version + 1
  where i.id = inv.id;
  update finance.credit_split s set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'the channel changed'
  where s.invoice_id = inv.id and s.deleted_at is null and s.note = 'channel: commercial';
  if coalesce(ch.credits_owner, false) and org is null then
    insert into finance.credit_split (invoice_id, person_id, share, note, created_by)
    values (inv.id, p_person, 1, 'channel: commercial', me);
  end if;
end
$$;

revoke all on function finance.channel_apply(uuid, text, uuid, uuid) from public;

create or replace function finance.channel_set(p_invoice uuid, p_channel text, p_person uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  inv finance.invoice;
  req uuid;
begin
  select * into inv from finance.invoice i where i.id = p_invoice and i.deleted_at is null for update;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'finance.channel_set', pg_catalog.jsonb_build_object('ref', inv.ref, 'channel', p_channel), p_reason);
  perform finance.channel_apply(inv.id, p_channel, p_person, me);
  perform audit.end();
  -- the request id, so the screen's Undo takes the change back (QA-548)
  return pg_catalog.jsonb_build_object('id', inv.id, 'channel', p_channel, 'request_id', req);
end
$$;

create or replace function finance.row_values(p_table text, p_fields jsonb, p_adding boolean) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  k text;
  v jsonb;
  out jsonb := '{}'::jsonb;
  st finance.status_map;
  given text;
  allowed text[] := case p_table
    when 'invoice' then array['customer_name', 'customer_name2', 'customer_email', 'customer_phone', 'client_id', 'tax_no',
                              'discount_code', 'status', 'created_on', 'generated_on', 'paid_on', 'due_on', 'total_sar',
                              'product', 'branch', 'salesman']
                        || case when p_adding then array['ref', 'kind', 'channel', 'credit_to'] else '{}'::text[] end
    when 'invoice_line' then array['name', 'qty', 'unit_price', 'discount_sar', 'taxable', 'total_sar', 'product', 'service']
                             || case when p_adding then array['invoice_id', 'line_no'] else '{}'::text[] end
    when 'expense_line' then array['expense_type', 'status', 'amount_sar', 'merchant', 'id_reference']
                             || case when p_adding then array['invoice_id'] else '{}'::text[] end
    when 'receipt' then array['method', 'amount_sar', 'paid_on', 'ref_at_method', 'paid_by', 'note']
                        || case when p_adding then array['invoice_id'] else '{}'::text[] end
  end;
begin
  if allowed is null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'table';
  end if;
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'object' or p_fields = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
  end if;
  for k, v in select e.key, e.value from pg_catalog.jsonb_each(p_fields) e loop
    if not (k = any (allowed)) then
      raise exception using errcode = 'P0001', message = 'common.invalid', detail = k;
    end if;
    given := nullif(pg_catalog.btrim(v #>> '{}'), '');
    case
      when k in ('channel', 'credit_to') and p_table = 'invoice' then
        null;  -- not columns: row_add sets them through finance.channel_apply in the same request (QA-548)
      when k = 'status' and p_table = 'invoice' then
        st := finance.status_of(given);
        if st.id is null then
          raise exception using errcode = 'P0001', message = 'finance.status_unknown', detail = coalesce(given, '');
        end if;
        out := out || pg_catalog.jsonb_build_object('status_raw', given, 'status_id', st.id);
      when k = 'status' then
        if finance.expense_status_of(given) is null then
          raise exception using errcode = 'P0001', message = 'finance.expense_status_unknown', detail = coalesce(given, '');
        end if;
        out := out || pg_catalog.jsonb_build_object('status_raw', given, 'status', finance.expense_status_of(given));
      when k = 'product' then
        if given is not null and finance.product_of(given) is null then
          raise exception using errcode = 'P0001', message = 'finance.product_unknown', detail = given;
        end if;
        out := out || pg_catalog.jsonb_build_object('product_raw', given, 'product_id', finance.product_of(given));
        if p_table = 'invoice_line' and not (p_fields ? 'service') then
          out := out || pg_catalog.jsonb_build_object('service_id',
                   (select p.service_id from finance.product p where p.id = finance.product_of(given)));
        end if;
      when k = 'service' then
        out := out || pg_catalog.jsonb_build_object('service_id', finance.entry_id('finance.service', given));
      when k in ('client_id', 'tax_no', 'discount_code', 'salesman') then
        out := out || pg_catalog.jsonb_build_object(k || '_raw', v);
      else
        out := out || pg_catalog.jsonb_build_object(k, v);
    end case;
  end loop;
  return out;
end
$$;

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
  if p_table = 'invoice' and (p_fields ? 'channel' or p_fields ? 'credit_to') then
    perform finance.channel_apply(rid, nullif(pg_catalog.btrim(p_fields ->> 'channel'), ''),
                                  nullif(pg_catalog.btrim(p_fields ->> 'credit_to'), '')::uuid, me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$$;
