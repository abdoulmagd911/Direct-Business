-- v2 finance, part 2 (P4-1b, V618): the Payments export import — one database door that takes the parsed rows of the
-- invoice export or of the transaction-expense export and writes them into the P4-1 facts with source = import. Statuses
-- go through the lists; anything unknown or unreadable is HELD with its reason, never guessed (D21); billing links come
-- from Payments' consolidation field, else as an amount proposal a person ticks (V616 — never by line names); a
-- hand-typed or removed row is never touched (D21, OA12); a blank never wipes, a stored value changes only when the file
-- is newer than the one it came from (§3.11.6); the same file twice changes nothing. The browser reads the file (§3.11
-- steps 1–3); the rules live here only (A10). Every import is one request, logged as Import (V44). Forward-only (V103).

-- ================================================================ what an import did (§3.11: io.batch, io.held)
create table finance.import_batch (
  id uuid primary key default gen_random_uuid(),
  file text not null check (file in ('invoices', 'expenses')),
  file_name text check (file_name is null or pg_catalog.length(file_name) <= 300),
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  export_time timestamptz not null,
  started_by uuid not null references core.person (id),
  request_id uuid references audit.request (id),
  counts jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(counts) = 'object'),
  created_at timestamptz not null default now()
);
create unique index import_batch_once on finance.import_batch (file_sha256) where file_sha256 is not null;
comment on table finance.import_batch is 'What one Payments import did (§3.11): its file, export time, who dropped it and its counts — a record, never a business figure.';

-- Each row an import could not take as it is, and why: `written` false — the row never became a record (unknown status
-- word, unreadable or future date, a hand-typed or removed row, an expense for a reference Finance lacks); true — it was
-- written and waits for a person (an unknown client ID, a match conflict, a billing link proposed or not found).
create table finance.import_held (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references finance.import_batch (id),
  row_no int not null,
  ref text,
  reason_key text not null,
  detail text,
  written boolean not null default false,
  raw jsonb not null check (pg_catalog.jsonb_typeof(raw) = 'object'),
  created_at timestamptz not null default now()
);
create index import_held_batch on finance.import_held (batch_id);
comment on table finance.import_held is 'Rows an import held, each with its reason (D21, §3.11.7); written = the row became a record and waits for a person.';

alter table finance.import_batch enable row level security;
alter table finance.import_held enable row level security;
select core.index_foreign_keys('finance');

-- ================================================================ reading the lists (§3.6)
-- The entry a Payments word maps to (spacing and case do not matter), or none: the row is held.
create function finance.status_of(p_word text) returns finance.status_map
language sql stable security definer set search_path = ''
as $$
  select s.* from finance.status_map s
  where s.deleted_at is null and s.active and norm.fold(s.word) = norm.fold(p_word)
$$;

create function finance.expense_status_of(p_word text) returns text
language sql stable security definer set search_path = ''
as $$
  select s.maps_to from finance.expense_status_word s
  where s.deleted_at is null and s.active and norm.fold(s.word) = norm.fold(p_word)
$$;

create function finance.product_of(p_word text) returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from finance.product p
  where p.deleted_at is null and p.active and norm.fold(coalesce(p.word, p.name_en)) = norm.fold(p_word)
$$;

-- Whether a line is a wallet top-up (MF7): its product is a wallet product, or its name carries a wallet word.
create function finance.is_wallet_line(p_product uuid, p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from finance.wallet_rule w
    where w.deleted_at is null and w.active
      and ((w.kind = 'product' and w.product_id = p_product)
           or (w.kind = 'name_contains'
               and (pg_catalog.strpos(norm.fold(p_name), norm.fold(w.name_en)) > 0
                    or pg_catalog.strpos(norm.fold(p_name), norm.fold(w.name_ar)) > 0))))
$$;

-- ================================================================ the organisation an invoice belongs to (§3.5)
-- The live match, read the same way by the import's held list and by every money view: the first level that finds an
-- organisation decides — the Payments client ID, then the VAT or CR, then the discount code in force on the created
-- date, then the contact email; two organisations at the deciding level is a conflict; a client ID that no organisation
-- holds stops there and never falls through (V420); a name never matches (V421). The full engine — its order as a
-- setting, pins and Needs a decision — is P4-3; this reads the same clues the same way.
create function finance.partner_match(p_invoice uuid)
returns table (partner_id uuid, state text, level text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v finance.invoice;
  hits uuid[];
begin
  select * into v from finance.invoice i where i.id = p_invoice;
  if v.id is null then
    return;
  end if;
  if v.client_id_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = v.client_id_key;
    if hits is null then
      return query select null::uuid, 'unknown_client_id'::text, 'client_id'::text;
      return;
    end if;
    return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                        case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'client_id'::text;
    return;
  end if;
  if v.tax_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind in ('vat', 'cr') and d.value_key = v.tax_key;
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'tax_no'::text;
      return;
    end if;
  end if;
  if v.code_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'discount_code' and d.value_key = v.code_key
      and v.created_on between coalesce(d.valid_from, '-infinity'::date) and coalesce(d.valid_to, 'infinity'::date);
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'code'::text;
      return;
    end if;
  end if;
  if v.email_key is not null then
    select pg_catalog.array_agg(distinct d.partner_id) into hits from partner.identifier d
    where d.deleted_at is null and d.kind = 'email' and d.value_key = v.email_key;
    if hits is not null then
      return query select case when pg_catalog.cardinality(hits) = 1 then hits[1] end,
                          case when pg_catalog.cardinality(hits) = 1 then 'matched' else 'conflict' end, 'email'::text;
      return;
    end if;
  end if;
  return query select null::uuid, 'none'::text, null::text;
end
$$;

-- ================================================================ reading a row's values
create function finance.row_text(p_row jsonb, p_key text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select nullif(pg_catalog.btrim(p_row ->> p_key), '') $$;

-- A date the browser read as ISO (YYYY-MM-DD, or a timestamp whose Riyadh day is taken), or a held reason.
create function finance.row_date(p_row jsonb, p_key text) returns date
language plpgsql immutable set search_path = ''
as $$
declare
  t text := finance.row_text(p_row, p_key);
begin
  if t is null then
    return null;
  end if;
  if t ~ '^\d{4}-\d{2}-\d{2}$' then
    return t::date;
  end if;
  return (t::timestamptz at time zone 'Asia/Riyadh')::date;
end
$$;

-- ================================================================ the merge rule (§3.11.6)
-- One generic rule for every fact field: a blank never wipes; a stored blank is filled from any file; a stored value
-- changes only when this file is newer than the export time recorded for that field (src). A field a person set in the
-- app (src 'person', V622) is the person's: no file changes it, and where the file differs the field is returned in
-- `kept`, so the import lists the difference for that person. Returns the fields to write, the new src and the kept
-- differences; nothing when the stored row already says it all.
create function finance.merge_fields(p_old jsonb, p_new jsonb, p_src jsonb, p_time timestamptz)
returns table (fields jsonb, src jsonb, kept jsonb)
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
  nv jsonb;
  ov jsonb;
  took jsonb := '{}'::jsonb;
  left_alone jsonb := '{}'::jsonb;
  s jsonb := coalesce(p_src, '{}'::jsonb);
begin
  for k, nv in select e.key, e.value from pg_catalog.jsonb_each(p_new) e loop
    continue when nv is null or nv = 'null'::jsonb;
    ov := p_old -> k;
    continue when ov = nv;
    if s ->> k = 'person' then
      left_alone := left_alone || pg_catalog.jsonb_build_object(k, nv);
    elsif ov is null or ov = 'null'::jsonb or p_time > coalesce((s ->> k)::timestamptz, '-infinity'::timestamptz) then
      took := took || pg_catalog.jsonb_build_object(k, nv);
      s := s || pg_catalog.jsonb_build_object(k, p_time);
    end if;
  end loop;
  return query select took, s, left_alone;
end
$$;

-- Whether a person set any field of a row (or added the row by hand beside the imported ones — `_row`), V622.
create function finance.by_person(p_src jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$ select exists (select 1 from pg_catalog.jsonb_each_text(coalesce(p_src, '{}'::jsonb)) e where e.value = 'person') $$;

-- ================================================================ the door
-- api.finance_import(file, rows, export time, file name, sha-256, dry run) — `file` is 'invoices' (the invoice export:
-- one object per invoice with its `lines`) or 'expenses' (the transaction-expense export: one object per expense). The
-- browser maps the export's headers to these keys (§3.11.1):
--   invoices: ref, type (invoice | credit_note), is_consolidated, consolidated_ref, consolidation_status, customer_name,
--     customer_email, customer_phone, client_id, tax_no, discount_code, status, status_at, created_on, generated_on,
--     paid_on, due_on, total_sar, product, branch, salesman, dpin, dpin_total,
--     lines [{line_no, product, name, qty, unit_price, discount_sar, taxable, total_sar}];
--   expenses: ref, expense_type, status, amount_sar, merchant, id_reference, created_at, submitted_at, decided_at,
--     submitter, approver, transaction_expense_status.
-- Dates are ISO (a timestamp's Riyadh day is taken); amounts are numbers in SAR as recorded. Needs the capability
-- finance.import. A dry run is the preview (§3.11.4): the same work, rolled back, with the same answer.
create function finance.import_run(p_file text, p_rows jsonb, p_export_time timestamptz, p_file_name text,
                                   p_sha256 text, p_dry_run boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_capability('finance.import');
  imp uuid := core.import_person_id();
  b uuid;
  prior finance.import_batch;
  req uuid;
  r jsonb;
  n int := 0;
  c_new int := 0; c_changed int := 0; c_unchanged int := 0; c_held int := 0;
  answer jsonb;
begin
  if p_file not in ('invoices', 'expenses') then
    raise exception using errcode = 'P0001', message = 'finance.import_unknown_file', detail = p_file;
  end if;
  if pg_catalog.jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'rows';
  end if;
  if p_export_time is null or p_export_time > pg_catalog.now() + interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'finance.import_export_time', detail = coalesce(p_export_time::text, '');
  end if;
  -- The same file twice changes nothing (§3.11.6).
  select * into prior from finance.import_batch x where x.file_sha256 = p_sha256;
  if prior.id is not null then
    return pg_catalog.jsonb_build_object('already_imported', true, 'batch_id', prior.id, 'on', prior.created_at,
                                         'by', prior.started_by, 'counts', prior.counts);
  end if;

  req := audit.begin('import', 'finance.imported',
                     pg_catalog.jsonb_build_object('file', p_file, 'rows', pg_catalog.jsonb_array_length(p_rows)));
  insert into finance.import_batch (file, file_name, file_sha256, export_time, started_by, request_id)
  values (p_file, p_file_name, p_sha256, p_export_time, me, req)
  returning id into b;

  for r in select x from pg_catalog.jsonb_array_elements(p_rows) x loop
    n := n + 1;
    case (case p_file when 'invoices' then finance.import_invoice(b, n, r, p_export_time, imp)
                      else finance.import_expense(b, n, r, p_export_time, imp) end)
      when 'new' then c_new := c_new + 1;
      when 'changed' then c_changed := c_changed + 1;
      when 'unchanged' then c_unchanged := c_unchanged + 1;
      else c_held := c_held + 1;
    end case;
  end loop;
  if p_file = 'invoices' then
    perform finance.import_links(b, p_rows, imp);
  end if;

  update finance.import_batch x
  set counts = pg_catalog.jsonb_build_object('read', n, 'new', c_new, 'changed', c_changed, 'unchanged', c_unchanged,
                                            'held', c_held)
  where x.id = b;
  select pg_catalog.jsonb_build_object(
           'batch_id', b, 'counts', x.counts,
           'held', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('row', h.row_no, 'ref', h.ref,
                                                                                      'reason', h.reason_key, 'detail', h.detail,
                                                                                      'written', h.written)
                                                         order by h.row_no, h.reason_key)
                             from finance.import_held h where h.batch_id = b), '[]'::jsonb))
  into answer from finance.import_batch x where x.id = b;
  perform audit.end();
  if p_dry_run then
    raise exception using errcode = 'P0001', message = 'finance.import_dry_run', detail = answer::text;
  end if;
  return answer;
end
$$;

create function api.finance_import(p_file text, p_rows jsonb, p_export_time timestamptz, p_file_name text default null,
                                   p_sha256 text default null, p_dry_run boolean default false)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
  return finance.import_run(p_file, p_rows, p_export_time, p_file_name, p_sha256, p_dry_run);
exception when sqlstate 'P0001' then
  -- the preview: everything above was rolled back; its answer is in the message's detail
  declare
    m text; d text;
  begin
    get stacked diagnostics m = message_text, d = pg_exception_detail;
    if m = 'finance.import_dry_run' then
      return d::jsonb || '{"dry_run": true}'::jsonb;
    end if;
    raise;
  end;
end
$$;
comment on function api.finance_import(text, jsonb, timestamptz, text, text, boolean) is 'P4-1b (V618): import the parsed rows of a Payments invoice or transaction-expense export; held rows say why; a dry run previews.';

-- ================================================================ one invoice row
-- Returns new, changed, unchanged or held.
create function finance.import_invoice(p_batch uuid, p_no int, p_row jsonb, p_time timestamptz, p_imp uuid) returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  ref text := finance.row_text(p_row, 'ref');
  cur finance.invoice;
  removed boolean;
  st finance.status_map;
  kind text;
  created date; generated date; paid date; due date; status_at timestamptz;
  total numeric;
  vals jsonb;
  m record;
  inv uuid;
  l jsonb;
  lines_newer boolean;
  touched boolean := false;
  dp text := finance.row_text(p_row, 'dpin');
  held boolean := false;
begin
  if ref is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, null, 'no_ref', p_row);
    return 'held';
  end if;
  -- the values, read or held
  begin
    created := finance.row_date(p_row, 'created_on');
    generated := finance.row_date(p_row, 'generated_on');
    paid := finance.row_date(p_row, 'paid_on');
    due := finance.row_date(p_row, 'due_on');
    status_at := finance.row_text(p_row, 'status_at')::timestamptz;
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_date', sqlerrm, p_row);
    return 'held';
  end;
  begin
    total := finance.row_text(p_row, 'total_sar')::numeric(14, 2);
    -- every line readable, with its total (an unreadable amount is held, never 0 — §3.11.2)
    perform finance.row_text(x, 'line_no')::int, finance.row_text(x, 'qty')::numeric,
            finance.row_text(x, 'unit_price')::numeric, finance.row_text(x, 'discount_sar')::numeric,
            (x ->> 'taxable')::boolean, finance.row_text(x, 'total_sar')::numeric(14, 2)
    from pg_catalog.jsonb_array_elements(coalesce(p_row -> 'lines', '[]'::jsonb)) x;
    if exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(p_row -> 'lines', '[]'::jsonb)) x
               where finance.row_text(x, 'total_sar') is null) then
      raise exception 'a line has no total';
    end if;
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount', finance.row_text(p_row, 'total_sar'), p_row);
    return 'held';
  end;
  if created is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'no_created_date', p_row);
    return 'held';
  end if;
  if greatest(created, generated, paid) > core.riyadh_today() then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'date_in_future', greatest(created, generated, paid)::text, p_row);
    return 'held';
  end if;
  st := finance.status_of(finance.row_text(p_row, 'status'));
  if st.id is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'status_unknown', coalesce(finance.row_text(p_row, 'status'), '(blank)'), p_row);
    return 'held';
  end if;

  -- a hand-typed row is never touched (D21); a removed one is never revived (OA12)
  select * into cur from finance.invoice i where i.ref = finance.row_text(p_row, 'ref') and i.deleted_at is null;
  removed := cur.id is null and exists (select 1 from finance.invoice i where i.ref = finance.row_text(p_row, 'ref'));
  if removed then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'removed_row', p_row);
    return 'held';
  end if;
  if cur.source = 'manual' then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'manual_row', 'typed by a person; the import never changes it', p_row);
    return 'held';
  end if;

  -- the kind as Payments shapes it (§3.6): a credit note; a billing invoice (is_consolidated); a transaction (it names
  -- the billing invoice it was consolidated into, or says it was); else standalone. Every line a wallet line: a top-up.
  kind := case when pg_catalog.lower(finance.row_text(p_row, 'type')) in ('credit_note', 'credit note') then 'credit_note'
               when coalesce(pg_catalog.lower(finance.row_text(p_row, 'is_consolidated')) in ('true', 'yes', '1'), false)
                 then 'billing'
               when finance.row_text(p_row, 'consolidated_ref') is not null
                    or pg_catalog.lower(finance.row_text(p_row, 'consolidation_status')) like 'consolidation%' then 'transaction'
               else 'standalone' end;
  if kind in ('transaction', 'standalone')
     and pg_catalog.jsonb_array_length(coalesce(p_row -> 'lines', '[]'::jsonb)) > 0
     and not exists (select 1 from pg_catalog.jsonb_array_elements(p_row -> 'lines') x
                     where not finance.is_wallet_line(finance.product_of(finance.row_text(x, 'product')),
                                                      finance.row_text(x, 'name'))) then
    kind := 'wallet_topup';
  end if;

  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'kind', kind,
    'customer_name', finance.row_text(p_row, 'customer_name'),
    'customer_email', pg_catalog.lower(finance.row_text(p_row, 'customer_email')),
    'customer_phone', finance.row_text(p_row, 'customer_phone'),
    'client_id_raw', finance.row_text(p_row, 'client_id'),
    'tax_no_raw', finance.row_text(p_row, 'tax_no'),
    'discount_code_raw', finance.row_text(p_row, 'discount_code'),
    'status_raw', finance.row_text(p_row, 'status'),
    'status_id', st.id,
    'status_at', status_at,
    'consolidation_status_raw', finance.row_text(p_row, 'consolidation_status'),
    'created_on', created, 'generated_on', generated, 'paid_on', paid, 'due_on', due,
    'total_sar', total,
    'product_raw', finance.row_text(p_row, 'product'),
    'product_id', finance.product_of(finance.row_text(p_row, 'product')),
    'branch', finance.row_text(p_row, 'branch'),
    'salesman_raw', finance.row_text(p_row, 'salesman')));

  if cur.id is null then
    insert into finance.invoice (ref, kind, customer_name, customer_email, customer_phone, client_id_raw, tax_no_raw,
                                 discount_code_raw, status_raw, status_id, status_at, consolidation_status_raw,
                                 created_on, generated_on, paid_on, due_on, total_sar, product_raw, product_id, branch,
                                 salesman_raw, source, src, first_batch_id, last_batch_id, payments_as_of, created_by)
    select ref, kind, x.customer_name, x.customer_email, x.customer_phone, x.client_id_raw, x.tax_no_raw,
           x.discount_code_raw, x.status_raw, x.status_id, x.status_at, x.consolidation_status_raw,
           x.created_on, x.generated_on, x.paid_on, x.due_on, x.total_sar, x.product_raw, x.product_id, x.branch,
           x.salesman_raw, 'import',
           (select pg_catalog.jsonb_object_agg(k, p_time) from pg_catalog.jsonb_object_keys(vals || '{"lines": 0}') k),
           p_batch, p_batch, (p_time at time zone 'Asia/Riyadh')::date, p_imp
    from pg_catalog.jsonb_populate_record(null::finance.invoice, vals) x
    returning id into inv;
    lines_newer := true;
    touched := true;
  else
    inv := cur.id;
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, cur.src, p_time);
    lines_newer := p_time > coalesce((cur.src ->> 'lines')::timestamptz, '-infinity'::timestamptz);
    if m.fields <> '{}'::jsonb then
      update finance.invoice i
      set (kind, customer_name, customer_email, customer_phone, client_id_raw, tax_no_raw, discount_code_raw, status_raw,
           status_id, status_at, consolidation_status_raw, created_on, generated_on, paid_on, due_on, total_sar,
           product_raw, product_id, branch, salesman_raw)
          = (select x.kind, x.customer_name, x.customer_email, x.customer_phone, x.client_id_raw, x.tax_no_raw,
                    x.discount_code_raw, x.status_raw, x.status_id, x.status_at, x.consolidation_status_raw, x.created_on,
                    x.generated_on, x.paid_on, x.due_on, x.total_sar, x.product_raw, x.product_id, x.branch, x.salesman_raw
             from pg_catalog.jsonb_populate_record(i, m.fields) x),
          src = m.src, last_batch_id = p_batch,
          payments_as_of = greatest(i.payments_as_of, (p_time at time zone 'Asia/Riyadh')::date),
          updated_at = pg_catalog.now(), updated_by = p_imp, version = i.version + 1
      where i.id = inv;
      touched := true;
    end if;
    -- a field a person edited stays theirs; the difference is listed for them (V622, D21)
    if m.kept <> '{}'::jsonb then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, p_no, ref, 'person_edited',
              (select pg_catalog.string_agg(k, ', ' order by k) from pg_catalog.jsonb_object_keys(m.kept) k), true, p_row);
    end if;
  end if;

  -- the lines: written whole from a newer file; an older one only adds a line the invoice lacks
  for l in select x from pg_catalog.jsonb_array_elements(coalesce(p_row -> 'lines', '[]'::jsonb)) x loop
    declare
      no int := coalesce(finance.row_text(l, 'line_no')::int, 0);
      old finance.invoice_line;
      lv jsonb;
    begin
      select * into old from finance.invoice_line x where x.invoice_id = inv and x.line_no = no and x.deleted_at is null;
      lv := pg_catalog.jsonb_build_object(
        'product_raw', finance.row_text(l, 'product'), 'product_id', finance.product_of(finance.row_text(l, 'product')),
        'name', coalesce(finance.row_text(l, 'name'), finance.row_text(l, 'product'), '—'),
        'qty', coalesce(finance.row_text(l, 'qty')::numeric, 1), 'unit_price', finance.row_text(l, 'unit_price')::numeric,
        'discount_sar', coalesce(finance.row_text(l, 'discount_sar')::numeric, 0),
        'taxable', coalesce((l ->> 'taxable')::boolean, true), 'total_sar', finance.row_text(l, 'total_sar')::numeric,
        'service_id', (select p.service_id from finance.product p where p.id = finance.product_of(finance.row_text(l, 'product'))));
      if old.id is null and exists (select 1 from finance.invoice_line x where x.invoice_id = inv and x.line_no = no
                                    and x.deleted_at is not null and x.deleted_by <> p_imp) then
        -- a line a person removed is never brought back (V622, OA12)
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
        values (p_batch, p_no, ref, 'removed_row', 'line ' || no, true, p_row);
      elsif old.id is not null and finance.by_person(old.src) then
        -- a line a person edited or added stays as they left it; a difference is listed for them (V622)
        if (pg_catalog.to_jsonb(old) - array['id', 'invoice_id', 'line_no', 'src', 'created_at', 'created_by', 'updated_at',
                                             'updated_by', 'version', 'deleted_at', 'deleted_by', 'delete_reason']) <> lv then
          insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
          values (p_batch, p_no, ref, 'person_edited', 'line ' || no, true, p_row);
        end if;
      elsif old.id is null then
        insert into finance.invoice_line (invoice_id, line_no, product_raw, product_id, name, qty, unit_price, discount_sar,
                                          taxable, total_sar, service_id, created_by)
        select inv, no, x.product_raw, x.product_id, x.name, x.qty, x.unit_price, x.discount_sar, x.taxable, x.total_sar,
               x.service_id, p_imp
        from pg_catalog.jsonb_populate_record(null::finance.invoice_line, lv) x;
        touched := true;
      elsif lines_newer and (pg_catalog.to_jsonb(old) - array['id', 'invoice_id', 'line_no', 'src', 'created_at', 'created_by',
                              'updated_at', 'updated_by', 'version', 'deleted_at', 'deleted_by', 'delete_reason']) <> lv then
        update finance.invoice_line x
        set (product_raw, product_id, name, qty, unit_price, discount_sar, taxable, total_sar, service_id)
            = (select y.product_raw, y.product_id, y.name, y.qty, y.unit_price, y.discount_sar, y.taxable, y.total_sar,
                      y.service_id from pg_catalog.jsonb_populate_record(null::finance.invoice_line, lv) y),
            updated_at = pg_catalog.now(), updated_by = p_imp, version = x.version + 1
        where x.id = old.id;
        touched := true;
      end if;
    end;
  end loop;
  if lines_newer and pg_catalog.jsonb_array_length(coalesce(p_row -> 'lines', '[]'::jsonb)) > 0 then
    update finance.invoice_line x
    set deleted_at = pg_catalog.now(), deleted_by = p_imp, delete_reason = 'not in the newer Payments export'
    where x.invoice_id = inv and x.deleted_at is null and not finance.by_person(x.src)
      and x.line_no not in (select coalesce(finance.row_text(e, 'line_no')::int, 0)
                            from pg_catalog.jsonb_array_elements(p_row -> 'lines') e);
    if found then
      touched := true;
    end if;
    update finance.invoice i set src = coalesce(i.src, '{}'::jsonb) || pg_catalog.jsonb_build_object('lines', p_time)
    where i.id = inv and (i.src ->> 'lines') is distinct from pg_catalog.to_jsonb(p_time) #>> '{}';
  end if;

  -- the DPIN (V617: its own field): on a billing or standalone invoice; a transaction's is held
  if dp is not null then
    if not finance.kind_allows(kind, 'dpin') then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, p_no, ref, 'dpin_on_' || kind, dp, true, p_row);
      held := true;
    elsif not exists (select 1 from finance.tax_invoice t where t.parent_invoice_id = inv and t.deleted_at is null) then
      if exists (select 1 from finance.tax_invoice t where t.dpin = dp and t.deleted_at is null) then
        insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
        values (p_batch, p_no, ref, 'dpin_repeats', dp, true, p_row);
        held := true;
      else
        insert into finance.tax_invoice (dpin, parent_invoice_id, total_sar, issued_on, source, created_by)
        values (dp, inv, finance.row_text(p_row, 'dpin_total')::numeric, generated, 'import', p_imp);
        touched := true;
      end if;
    end if;
  end if;

  -- the organisation (§3.5): an unknown client ID or a conflict waits for a person (V420)
  select * into m from finance.partner_match(inv);
  if m.state in ('unknown_client_id', 'conflict') then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
    values (p_batch, p_no, ref, m.state, m.level, true, p_row);
  end if;

  return case when cur.id is null then 'new' when touched then 'changed' else 'unchanged' end;
end
$$;

-- ================================================================ one expense row
create function finance.import_expense(p_batch uuid, p_no int, p_row jsonb, p_time timestamptz, p_imp uuid) returns text
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_variable
declare
  ref text := finance.row_text(p_row, 'ref');
  inv finance.invoice;
  st text;
  tst text;
  created_src timestamptz;
  amount numeric;
  key text;
  cur finance.expense_line;
  vals jsonb;
  m record;
  result text;
begin
  if ref is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, null, 'no_ref', p_row);
    return 'held';
  end if;
  select * into inv from finance.invoice i where i.ref = finance.row_text(p_row, 'ref') and i.deleted_at is null;
  if inv.id is null then
    -- a cost line for a reference Finance lacks: held; the cumulative export brings it again (§3.11.7)
    insert into finance.import_held (batch_id, row_no, ref, reason_key, raw) values (p_batch, p_no, ref, 'no_invoice', p_row);
    return 'held';
  end if;
  if inv.source = 'manual' then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'manual_row', 'typed by a person; the import never changes it', p_row);
    return 'held';
  end if;
  if not finance.kind_allows(inv.kind, 'expense') then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'expense_on_' || inv.kind, finance.row_text(p_row, 'expense_type'), p_row);
    return 'held';
  end if;
  -- a status word maps through the list; a blank one reads issued — done (V611)
  st := case when finance.row_text(p_row, 'status') is null then 'issued' else finance.expense_status_of(p_row ->> 'status') end;
  if st is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'expense_status_unknown', p_row ->> 'status', p_row);
    return 'held';
  end if;
  if p_row ? 'transaction_expense_status' then
    tst := case when finance.row_text(p_row, 'transaction_expense_status') is null then 'issued'
                else finance.expense_status_of(p_row ->> 'transaction_expense_status') end;
    if tst is null then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
      values (p_batch, p_no, ref, 'expense_status_unknown', p_row ->> 'transaction_expense_status', p_row);
      return 'held';
    end if;
  end if;
  begin
    created_src := finance.row_text(p_row, 'created_at')::timestamptz;
    amount := finance.row_text(p_row, 'amount_sar')::numeric(14, 2);
    perform finance.row_text(p_row, 'submitted_at')::timestamptz, finance.row_text(p_row, 'decided_at')::timestamptz;
  exception when others then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'bad_amount_or_date', sqlerrm, p_row);
    return 'held';
  end;
  if st in ('approved', 'issued') and amount is null then
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'approved_without_amount', p_row ->> 'expense_type', p_row);
    return 'held';
  end if;
  key := pg_catalog.concat_ws('|', ref, norm.fold(coalesce(finance.row_text(p_row, 'expense_type'), '—')), created_src);
  vals := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'expense_type', coalesce(finance.row_text(p_row, 'expense_type'), '—'), 'status', st,
    'status_raw', finance.row_text(p_row, 'status'), 'amount_sar', amount, 'merchant', finance.row_text(p_row, 'merchant'),
    'id_reference', finance.row_text(p_row, 'id_reference'), 'created_at_src', created_src,
    'submitted_at', finance.row_text(p_row, 'submitted_at')::timestamptz,
    'decided_at', finance.row_text(p_row, 'decided_at')::timestamptz,
    'submitter', finance.row_text(p_row, 'submitter'), 'approver', finance.row_text(p_row, 'approver')));
  select * into cur from finance.expense_line e where e.line_key = key and e.deleted_at is null;
  if cur.id is null and exists (select 1 from finance.expense_line e where e.line_key = key and e.deleted_at is not null
                                and e.deleted_by <> p_imp) then
    -- an expense a person removed is never brought back (V622, OA12)
    insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, raw)
    values (p_batch, p_no, ref, 'removed_row', p_row ->> 'expense_type', p_row);
    return 'held';
  end if;
  if cur.id is null then
    insert into finance.expense_line (invoice_id, line_key, expense_type, status, status_raw, amount_sar, merchant,
                                      id_reference, created_at_src, submitted_at, decided_at, submitter, approver, source,
                                      src, created_by)
    select inv.id, key, x.expense_type, x.status, x.status_raw, x.amount_sar, x.merchant, x.id_reference, x.created_at_src,
           x.submitted_at, x.decided_at, x.submitter, x.approver, 'import',
           (select pg_catalog.jsonb_object_agg(k, p_time) from pg_catalog.jsonb_object_keys(vals) k), p_imp
    from pg_catalog.jsonb_populate_record(null::finance.expense_line, vals) x;
    result := 'new';
  else
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(cur), vals, cur.src, p_time);
    if m.fields <> '{}'::jsonb then
      update finance.expense_line e
      set (expense_type, status, status_raw, amount_sar, merchant, id_reference, submitted_at, decided_at, submitter, approver)
          = (select x.expense_type, x.status, x.status_raw, x.amount_sar, x.merchant, x.id_reference, x.submitted_at,
                    x.decided_at, x.submitter, x.approver from pg_catalog.jsonb_populate_record(e, m.fields) x),
          src = m.src, updated_at = pg_catalog.now(), updated_by = p_imp, version = e.version + 1
      where e.id = cur.id;
      result := 'changed';
    else
      result := 'unchanged';
    end if;
    if m.kept <> '{}'::jsonb then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, p_no, ref, 'person_edited',
              (select pg_catalog.string_agg(k, ', ' order by k) from pg_catalog.jsonb_object_keys(m.kept) k), true, p_row);
    end if;
  end if;
  -- the transaction-level expense status, by the same merge rule
  if tst is not null then
    select * into m from finance.merge_fields(pg_catalog.to_jsonb(inv),
                                              pg_catalog.jsonb_build_object('expense_status', tst,
                                                                            'expense_status_raw', finance.row_text(p_row, 'transaction_expense_status')),
                                              inv.src, p_time);
    if m.fields ? 'expense_status' then
      update finance.invoice i
      set expense_status = m.fields ->> 'expense_status', expense_status_raw = coalesce(m.fields ->> 'expense_status_raw', i.expense_status_raw),
          src = m.src, updated_at = pg_catalog.now(), updated_by = p_imp, version = i.version + 1
      where i.id = inv.id;
      if result = 'unchanged' then
        result := 'changed';
      end if;
    end if;
  end if;
  return result;
end
$$;

-- ================================================================ billing links (§3.11.8, V616)
-- From Payments' consolidation field wherever the file carries it; else, for a billing invoice still linked to nothing,
-- an amount proposal: the one set of at most six unlinked transactions of the same customer whose totals add up to its
-- total exactly (on cents) — a person ticks it. None, or more than one such set: held, said, never guessed.
create function finance.import_links(p_batch uuid, p_rows jsonb, p_imp uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  n int := 0;
  t finance.invoice;
  bi finance.invoice;
  cur uuid;
  sets uuid[];
  found_sets int;
begin
  for r in select x from pg_catalog.jsonb_array_elements(p_rows) x loop
    n := n + 1;
    continue when finance.row_text(r, 'consolidated_ref') is null;
    select * into t from finance.invoice i
    where i.ref = finance.row_text(r, 'ref') and i.deleted_at is null and i.source = 'import';
    continue when t.id is null or t.kind <> 'transaction';
    select * into bi from finance.invoice i where i.ref = finance.row_text(r, 'consolidated_ref') and i.deleted_at is null;
    if bi.id is null or bi.kind <> 'billing' then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, t.ref, 'billing_unknown', finance.row_text(r, 'consolidated_ref'), true, r);
      continue;
    end if;
    select l.billing_invoice_id into cur from finance.billing_link l
    where l.transaction_invoice_id = t.id and l.deleted_at is null;
    if cur is null then
      insert into finance.billing_link (billing_invoice_id, transaction_invoice_id, source, created_by)
      values (bi.id, t.id, 'payments', p_imp);
    elsif cur <> bi.id then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, t.ref, 'link_conflict', finance.row_text(r, 'consolidated_ref'), true, r);
    end if;
  end loop;

  -- the amount proposals
  n := 0;
  for r in select x from pg_catalog.jsonb_array_elements(p_rows) x loop
    n := n + 1;
    select * into bi from finance.invoice i
    where i.ref = finance.row_text(r, 'ref') and i.deleted_at is null and i.source = 'import' and i.kind = 'billing';
    continue when bi.id is null or bi.total_sar is null
      or exists (select 1 from finance.billing_link l where l.billing_invoice_id = bi.id and l.deleted_at is null)
      or exists (select 1 from finance.billing_proposal p where p.billing_invoice_id = bi.id and p.deleted_at is null
                 and p.state = 'open');
    select pg_catalog.count(*) into found_sets from (select 1 from finance.amount_sets(bi.id) limit 2) z;
    select s.ids into sets from finance.amount_sets(bi.id) s limit 1;
    if found_sets = 1 then
      insert into finance.billing_proposal (billing_invoice_id, transaction_ids, amount_sar, created_by)
      values (bi.id, sets, bi.total_sar, p_imp);
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, bi.ref, 'link_proposed', pg_catalog.cardinality(sets) || ' transaction(s)', true, r);
    else
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, bi.ref, 'link_not_found', case when found_sets = 0 then 'no set adds up' else 'several sets add up' end,
              true, r);
    end if;
  end loop;
end
$$;

-- The sets of at most six unlinked transactions of the billing invoice's customer, created on or before it, whose totals
-- add up to its total exactly — on cents, over its sixteen nearest candidates (§3.11.8: capped).
create function finance.amount_sets(p_billing uuid) returns table (ids uuid[])
language sql stable security definer set search_path = ''
as $$
  with recursive bi as (
    select i.* from finance.invoice i where i.id = p_billing
  ), cand as (
    select t.id, (t.total_sar * 100)::bigint as cents, pg_catalog.row_number() over (order by t.created_on desc, t.ref) as k
    from finance.invoice t, bi
    where t.deleted_at is null and t.kind = 'transaction' and t.total_sar is not null and t.created_on <= bi.created_on
      and not exists (select 1 from finance.billing_link l where l.transaction_invoice_id = t.id and l.deleted_at is null)
      and coalesce(t.client_id_key = bi.client_id_key, t.email_key = bi.email_key, t.name_key = bi.name_key, false)
    order by t.created_on desc, t.ref
    limit 16
  ), walk as (
    select array[c.id] as ids, c.cents as total, c.k as last from cand c
    union all
    select w.ids || c.id, w.total + c.cents, c.k from walk w join cand c on c.k > w.last
    where pg_catalog.cardinality(w.ids) < 6 and w.total < (select (b.total_sar * 100)::bigint from bi b)
  )
  select w.ids from walk w where w.total = (select (b.total_sar * 100)::bigint from bi b)
$$;

-- ================================================================ ticking a proposal (V616)
-- A person with Full on Finance ticks an amount proposal (its transactions become the billing invoice's, one request,
-- one Undo) or dismisses it.
create function finance.proposal_decide(p_id uuid, p_tick boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  p finance.billing_proposal;
  t uuid;
begin
  select * into p from finance.billing_proposal x where x.id = p_id and x.deleted_at is null for update;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p.state <> 'open' then
    raise exception using errcode = 'P0001', message = 'finance.proposal_decided', detail = p.state;
  end if;
  perform audit.begin('ui', case when p_tick then 'finance.proposal_ticked' else 'finance.proposal_dismissed' end,
                      pg_catalog.jsonb_build_object('ref', (select i.ref from finance.invoice i where i.id = p.billing_invoice_id)),
                      p_reason);
  if p_tick then
    foreach t in array p.transaction_ids loop
      if exists (select 1 from finance.billing_link l where l.transaction_invoice_id = t and l.deleted_at is null) then
        raise exception using errcode = 'P0001', message = 'finance.transaction_already_billed',
          detail = (select i.ref from finance.invoice i where i.id = t);
      end if;
      insert into finance.billing_link (billing_invoice_id, transaction_invoice_id, source, created_by)
      values (p.billing_invoice_id, t, 'proposal', me);
    end loop;
  end if;
  update finance.billing_proposal x
  set state = case when p_tick then 'ticked' else 'dismissed' end, decided_at = pg_catalog.now(), decided_by = me,
      updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = p.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p.id, 'state', case when p_tick then 'ticked' else 'dismissed' end);
end
$$;

create function api.finance_proposal_decide(p_id uuid, p_tick boolean, p_reason text default null) returns jsonb
language sql security invoker set search_path = ''
as $$ select finance.proposal_decide(p_id, p_tick, p_reason) $$;

-- ================================================================ grants
revoke all on function finance.import_run(text, jsonb, timestamptz, text, text, boolean) from public;
revoke all on function finance.proposal_decide(uuid, boolean, text) from public;
grant usage on schema finance to authenticated;
grant execute on function finance.import_run(text, jsonb, timestamptz, text, text, boolean) to authenticated;
grant execute on function finance.proposal_decide(uuid, boolean, text) to authenticated;
grant execute on function api.finance_import(text, jsonb, timestamptz, text, text, boolean) to authenticated;
grant execute on function api.finance_proposal_decide(uuid, boolean, text) to authenticated;
