-- The Payments client list and promo codes exports (second builder, 28 Sep 2026; DECISIONS D28). Rollback:
-- clients-promo-import.rollback.sql. Read in the browser by js/121 (through js/120's reader); written ONLY by the two
-- functions below, called by a person on Finance → Import (D17: a person imports; nothing is created by a background pass).
--
-- What each file gives (Drive 04 §5 column map):
--   · Corporate clients export — ID (KEY) → public.payments_clients, a mirror of Payments' client register (names,
--     payment mode, VAT and ID numbers, contact, credit terms, tender figures). It writes NOTHING onto invoice rows:
--     matching a money row to a company is a live view over each company's identifiers, never a stamp (the owner's
--     ruling of 28 Sep, company identifiers). Nothing here links a Payments client to a company in the app.
--   · Promo codes export — Code (KEY) → public.promo_codes (the existing registry): dates, totals, type and discount,
--     status; its Client Name is kept as a SUGGESTION only (payments_client_name) — a person links a code to a company.
-- The owner's rules (Drive 04 §5): any file, any order, any time; a newer file (its Payments export time) wins, an older
-- one only fills blanks, a blank never wipes; the same file twice changes nothing. Every change is in the change log.

-- =====================================================================
-- 1. the Payments client register (mirror)
-- =====================================================================
create table if not exists public.payments_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,          -- the export's "ID" = Direct Payments corporate_client.id
  legal_name text, legal_name_ar text, trading_name text, customer_type text, payment_config text, payment_mode text,
  billing_cycle text, tender_no text, registration_numbers text, has_vat_number text, id_type text, id_number text,
  vat_number text, contact_information text, contact_name text, contact_email text, contact_phone text,
  credit_limit_sar numeric, credit_term_days int, block_on_overdue text, tender_amount_sar numeric,
  expected_cogs_sar numeric, expected_gp_sar numeric, pricing_setting text, payments_created_by text,
  payments_updated_by text, payments_created_at timestamptz, payments_updated_at timestamptz,
  seen_at timestamptz,                     -- the Payments export time of the newest file that wrote this row
  source_batch text,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_clients_email on public.payments_clients (lower(btrim(contact_email)));

alter table public.payments_clients enable row level security;
drop policy if exists payments_clients_read on public.payments_clients;
drop policy if exists payments_clients_write on public.payments_clients;
create policy payments_clients_read on public.payments_clients for select using (public.can_see_page('finance'));
create policy payments_clients_write on public.payments_clients for all
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
revoke all on public.payments_clients from anon;
drop trigger if exists trg_record_history on public.payments_clients;
create trigger trg_record_history after insert or update or delete on public.payments_clients
  for each row execute function public.record_history_write();

-- =====================================================================
-- 2. the promo codes registry: what Payments says about each code, beside what the app already holds
-- =====================================================================
alter table public.promo_codes
  add column if not exists payments_promo_type text,      -- "Promocode Type"
  add column if not exists payments_discount_type text,   -- "Type" as written (percentage / fixed …)
  add column if not exists payments_discount numeric,     -- "Discount"
  add column if not exists payments_product text,         -- "Product" as written (services[] is the app's own list)
  add column if not exists payments_status text,          -- "Status" as written
  add column if not exists payments_client_name text,     -- "Client Name": a SUGGESTION — a person links the company
  add column if not exists payments_created_at timestamptz, -- "Created At" / "Created By" as Payments wrote them
  add column if not exists payments_created_by text,
  add column if not exists payments_seen_at timestamptz;  -- the export time of the newest file that wrote this code

-- =====================================================================
-- 3. one rule for every field: a blank never wipes; a newer file wins; an older one only fills a blank
-- =====================================================================
create or replace function public.payments_pick(p_old anyelement, p_new anyelement, p_newer boolean)
returns anyelement language sql immutable as $$
  select case when p_new is null then p_old when p_newer then p_new else coalesce(p_old, p_new) end
$$;

-- =====================================================================
-- 4. the client list import
-- =====================================================================
create or replace function public.fn_payments_clients_import(
  p_rows jsonb default '[]'::jsonb,       -- one object per client, already read and named by js/121
  p_seen_at timestamptz default null,     -- the file's Payments export time
  p_batch text default null)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_seen timestamptz := coalesce(p_seen_at, now());
  n_new int := 0; n_changed int := 0; n_in int := 0;
begin
  if not public.can_edit_page('finance') then
    raise exception 'client list import: this needs Full control of Finance' using errcode = '42501';
  end if;

  drop table if exists _pc_in;
  create temp table _pc_in on commit drop as
  select distinct on (btrim(x.client_id)) btrim(x.client_id) as client_id,
    nullif(btrim(x.legal_name), '') legal_name, nullif(btrim(x.legal_name_ar), '') legal_name_ar,
    nullif(btrim(x.trading_name), '') trading_name, nullif(btrim(x.customer_type), '') customer_type,
    nullif(btrim(x.payment_config), '') payment_config, nullif(btrim(x.payment_mode), '') payment_mode,
    nullif(btrim(x.billing_cycle), '') billing_cycle, nullif(btrim(x.tender_no), '') tender_no,
    nullif(btrim(x.registration_numbers), '') registration_numbers,
    nullif(btrim(x.has_vat_number), '') has_vat_number, nullif(btrim(x.id_type), '') id_type,
    nullif(btrim(x.id_number), '') id_number, nullif(btrim(x.vat_number), '') vat_number,
    nullif(btrim(x.contact_information), '') contact_information, nullif(btrim(x.contact_name), '') contact_name,
    nullif(lower(btrim(x.contact_email)), '') contact_email, nullif(btrim(x.contact_phone), '') contact_phone,
    x.credit_limit_sar, x.credit_term_days, nullif(btrim(x.block_on_overdue), '') block_on_overdue,
    x.tender_amount_sar, x.expected_cogs_sar, x.expected_gp_sar,
    nullif(btrim(x.pricing_setting), '') pricing_setting,
    nullif(btrim(x.payments_created_by), '') payments_created_by,
    nullif(btrim(x.payments_updated_by), '') payments_updated_by, x.payments_created_at, x.payments_updated_at
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(client_id text,
    legal_name text, legal_name_ar text, trading_name text, customer_type text, payment_config text,
    payment_mode text, billing_cycle text, tender_no text, registration_numbers text, has_vat_number text,
    id_type text, id_number text, vat_number text, contact_information text, contact_name text, contact_email text,
    contact_phone text, credit_limit_sar numeric, credit_term_days int, block_on_overdue text,
    tender_amount_sar numeric, expected_cogs_sar numeric, expected_gp_sar numeric, pricing_setting text,
    payments_created_by text, payments_updated_by text, payments_created_at timestamptz,
    payments_updated_at timestamptz)
  where nullif(btrim(x.client_id), '') is not null
  order by btrim(x.client_id);
  select count(*) into n_in from _pc_in;

  -- clients already known: field by field, only where something differs (the same file twice writes nothing)
  with m as (
    select t.id,
      payments_pick(t.legal_name, x.legal_name, n.nw) legal_name,
      payments_pick(t.legal_name_ar, x.legal_name_ar, n.nw) legal_name_ar,
      payments_pick(t.trading_name, x.trading_name, n.nw) trading_name,
      payments_pick(t.customer_type, x.customer_type, n.nw) customer_type,
      payments_pick(t.payment_config, x.payment_config, n.nw) payment_config,
      payments_pick(t.payment_mode, x.payment_mode, n.nw) payment_mode,
      payments_pick(t.billing_cycle, x.billing_cycle, n.nw) billing_cycle,
      payments_pick(t.tender_no, x.tender_no, n.nw) tender_no,
      payments_pick(t.registration_numbers, x.registration_numbers, n.nw) registration_numbers,
      payments_pick(t.has_vat_number, x.has_vat_number, n.nw) has_vat_number,
      payments_pick(t.id_type, x.id_type, n.nw) id_type, payments_pick(t.id_number, x.id_number, n.nw) id_number,
      payments_pick(t.vat_number, x.vat_number, n.nw) vat_number,
      payments_pick(t.contact_information, x.contact_information, n.nw) contact_information,
      payments_pick(t.contact_name, x.contact_name, n.nw) contact_name,
      payments_pick(t.contact_email, x.contact_email, n.nw) contact_email,
      payments_pick(t.contact_phone, x.contact_phone, n.nw) contact_phone,
      payments_pick(t.credit_limit_sar, x.credit_limit_sar, n.nw) credit_limit_sar,
      payments_pick(t.credit_term_days, x.credit_term_days, n.nw) credit_term_days,
      payments_pick(t.block_on_overdue, x.block_on_overdue, n.nw) block_on_overdue,
      payments_pick(t.tender_amount_sar, x.tender_amount_sar, n.nw) tender_amount_sar,
      payments_pick(t.expected_cogs_sar, x.expected_cogs_sar, n.nw) expected_cogs_sar,
      payments_pick(t.expected_gp_sar, x.expected_gp_sar, n.nw) expected_gp_sar,
      payments_pick(t.pricing_setting, x.pricing_setting, n.nw) pricing_setting,
      payments_pick(t.payments_created_by, x.payments_created_by, n.nw) payments_created_by,
      payments_pick(t.payments_updated_by, x.payments_updated_by, n.nw) payments_updated_by,
      payments_pick(t.payments_created_at, x.payments_created_at, n.nw) payments_created_at,
      payments_pick(t.payments_updated_at, x.payments_updated_at, n.nw) payments_updated_at,
      greatest(t.seen_at, v_seen) seen_at
    from _pc_in x join public.payments_clients t on t.client_id = x.client_id
    cross join lateral (select (t.seen_at is null or v_seen >= t.seen_at) nw) n)
  update public.payments_clients t set
    legal_name = m.legal_name, legal_name_ar = m.legal_name_ar, trading_name = m.trading_name,
    customer_type = m.customer_type, payment_config = m.payment_config, payment_mode = m.payment_mode,
    billing_cycle = m.billing_cycle, tender_no = m.tender_no, registration_numbers = m.registration_numbers,
    has_vat_number = m.has_vat_number, id_type = m.id_type, id_number = m.id_number, vat_number = m.vat_number,
    contact_information = m.contact_information, contact_name = m.contact_name, contact_email = m.contact_email,
    contact_phone = m.contact_phone, credit_limit_sar = m.credit_limit_sar, credit_term_days = m.credit_term_days,
    block_on_overdue = m.block_on_overdue, tender_amount_sar = m.tender_amount_sar,
    expected_cogs_sar = m.expected_cogs_sar, expected_gp_sar = m.expected_gp_sar,
    pricing_setting = m.pricing_setting, payments_created_by = m.payments_created_by,
    payments_updated_by = m.payments_updated_by, payments_created_at = m.payments_created_at,
    payments_updated_at = m.payments_updated_at,
    seen_at = m.seen_at, source_batch = p_batch, updated_at = now()
  from m
  where t.id = m.id
    and row(t.legal_name, t.legal_name_ar, t.trading_name, t.customer_type, t.payment_config, t.payment_mode,
            t.billing_cycle, t.tender_no, t.registration_numbers, t.has_vat_number, t.id_type, t.id_number,
            t.vat_number, t.contact_information, t.contact_name, t.contact_email, t.contact_phone,
            t.credit_limit_sar, t.credit_term_days, t.block_on_overdue, t.tender_amount_sar, t.expected_cogs_sar,
            t.expected_gp_sar, t.pricing_setting, t.payments_created_by, t.payments_updated_by,
            t.payments_created_at, t.payments_updated_at, t.seen_at)
        is distinct from
        row(m.legal_name, m.legal_name_ar, m.trading_name, m.customer_type, m.payment_config, m.payment_mode,
            m.billing_cycle, m.tender_no, m.registration_numbers, m.has_vat_number, m.id_type, m.id_number,
            m.vat_number, m.contact_information, m.contact_name, m.contact_email, m.contact_phone,
            m.credit_limit_sar, m.credit_term_days, m.block_on_overdue, m.tender_amount_sar, m.expected_cogs_sar,
            m.expected_gp_sar, m.pricing_setting, m.payments_created_by, m.payments_updated_by,
            m.payments_created_at, m.payments_updated_at, m.seen_at);
  get diagnostics n_changed = row_count;

  insert into public.payments_clients (client_id,
    legal_name, legal_name_ar, trading_name, customer_type, payment_config, payment_mode, billing_cycle, tender_no,
    registration_numbers, has_vat_number, id_type, id_number, vat_number, contact_information, contact_name,
    contact_email, contact_phone, credit_limit_sar, credit_term_days, block_on_overdue, tender_amount_sar,
    expected_cogs_sar, expected_gp_sar, pricing_setting, payments_created_by, payments_updated_by,
    payments_created_at, payments_updated_at, seen_at, source_batch)
  select x.client_id,
    x.legal_name, x.legal_name_ar, x.trading_name, x.customer_type, x.payment_config, x.payment_mode,
    x.billing_cycle, x.tender_no, x.registration_numbers, x.has_vat_number, x.id_type, x.id_number, x.vat_number,
    x.contact_information, x.contact_name, x.contact_email, x.contact_phone, x.credit_limit_sar, x.credit_term_days,
    x.block_on_overdue, x.tender_amount_sar, x.expected_cogs_sar, x.expected_gp_sar, x.pricing_setting,
    x.payments_created_by, x.payments_updated_by, x.payments_created_at, x.payments_updated_at, v_seen, p_batch
  from _pc_in x where not exists (select 1 from public.payments_clients t where t.client_id = x.client_id);
  get diagnostics n_new = row_count;

  return jsonb_build_object('clients_in_file', n_in, 'clients_new', n_new, 'clients_changed', n_changed,
    'clients_same', n_in - n_new - n_changed);
end;
$function$;
revoke all on function public.fn_payments_clients_import(jsonb, timestamptz, text) from public, anon;
grant execute on function public.fn_payments_clients_import(jsonb, timestamptz, text) to authenticated;

-- =====================================================================
-- 5. the promo codes import
-- =====================================================================
create or replace function public.fn_promo_codes_import(
  p_rows jsonb default '[]'::jsonb,       -- one object per code, already read and named by js/121
  p_seen_at timestamptz default null,
  p_batch text default null)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_seen timestamptz := coalesce(p_seen_at, now());
  n_new int := 0; n_changed int := 0; n_in int := 0; n_no_type int := 0;
begin
  if not public.can_edit_page('finance') then
    raise exception 'promo codes import: this needs Full control of Finance' using errcode = '42501';
  end if;

  drop table if exists _pr_in;
  create temp table _pr_in on commit drop as
  select distinct on (lower(btrim(x.code))) btrim(x.code) as code, lower(btrim(x.code)) as code_norm,
    nullif(btrim(x.promo_type), '') promo_type, nullif(btrim(x.discount_type), '') discount_type, x.discount,
    nullif(btrim(x.product), '') product, nullif(btrim(x.status), '') status, nullif(btrim(x.client_name), '') client_name,
    x.valid_from, x.valid_to, x.total_sales_sar, x.total_discount_sar,
    case when x.kind in ('percent', 'fixed') then x.kind end kind,
    case when x.kind in ('percent', 'fixed') then x.discount end value_pct,   -- the app keeps a fixed amount here too (js/113)
    x.active, x.expired, x.payments_created_at, nullif(btrim(x.payments_created_by), '') payments_created_by
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(code text, promo_type text, discount_type text, discount numeric,
    product text, status text, client_name text, valid_from date, valid_to date, total_sales_sar numeric,
    total_discount_sar numeric, kind text, active boolean, expired boolean, payments_created_at timestamptz,
    payments_created_by text)
  where nullif(btrim(x.code), '') is not null
  order by lower(btrim(x.code));
  select count(*) into n_in from _pr_in;

  with m as (
    select t.id,
      payments_pick(t.payments_promo_type, x.promo_type, n.nw) promo_type, payments_pick(t.payments_discount_type, x.discount_type, n.nw) discount_type,
      payments_pick(t.payments_discount, x.discount, n.nw) discount, payments_pick(t.payments_product, x.product, n.nw) product,
      payments_pick(t.payments_status, x.status, n.nw) status, payments_pick(t.payments_client_name, x.client_name, n.nw) client_name,
      payments_pick(t.valid_from, x.valid_from, n.nw) valid_from, payments_pick(t.valid_to, x.valid_to, n.nw) valid_to,
      payments_pick(t.total_sales_sar, x.total_sales_sar, n.nw) total_sales_sar, payments_pick(t.total_discount_sar, x.total_discount_sar, n.nw) total_discount_sar,
      payments_pick(t.kind, x.kind, n.nw) kind, payments_pick(t.value_pct, x.value_pct, n.nw) value_pct,
      payments_pick(t.active, x.active, n.nw) active, payments_pick(t.expired, x.expired, n.nw) expired,
      payments_pick(t.payments_created_at, x.payments_created_at, n.nw) created_at, payments_pick(t.payments_created_by, x.payments_created_by, n.nw) created_by,
      greatest(t.payments_seen_at, v_seen) seen_at
    from _pr_in x join public.promo_codes t on lower(btrim(t.code)) = x.code_norm
    cross join lateral (select (t.payments_seen_at is null or v_seen >= t.payments_seen_at) nw) n)
  update public.promo_codes t set
    payments_promo_type = m.promo_type, payments_discount_type = m.discount_type, payments_discount = m.discount,
    payments_product = m.product, payments_status = m.status, payments_client_name = m.client_name,
    valid_from = m.valid_from, valid_to = m.valid_to, total_sales_sar = m.total_sales_sar, total_discount_sar = m.total_discount_sar,
    kind = m.kind, value_pct = m.value_pct, active = m.active, expired = m.expired, payments_created_at = m.created_at,
    payments_created_by = m.created_by, payments_seen_at = m.seen_at, updated_at = now()
  from m
  where t.id = m.id
    and row(t.payments_promo_type, t.payments_discount_type, t.payments_discount, t.payments_product, t.payments_status,
            t.payments_client_name, t.valid_from, t.valid_to, t.total_sales_sar, t.total_discount_sar, t.kind, t.value_pct,
            t.active, t.expired, t.payments_created_at, t.payments_created_by, t.payments_seen_at)
        is distinct from
        row(m.promo_type, m.discount_type, m.discount, m.product, m.status, m.client_name, m.valid_from, m.valid_to,
            m.total_sales_sar, m.total_discount_sar, m.kind, m.value_pct, m.active, m.expired, m.created_at, m.created_by, m.seen_at);
  get diagnostics n_changed = row_count;

  -- a NEW code needs its type (the registry's kind is required): one whose type cannot be read is left out and counted
  select count(*) into n_no_type from _pr_in x
   where x.kind is null and not exists (select 1 from public.promo_codes t where lower(btrim(t.code)) = x.code_norm);
  insert into public.promo_codes (code, kind, value_pct, valid_from, valid_to, total_sales_sar, total_discount_sar, active,
    expired, payments_promo_type, payments_discount_type, payments_discount, payments_product, payments_status,
    payments_client_name, payments_created_at, payments_created_by, payments_seen_at)
  select x.code, x.kind, x.value_pct, x.valid_from, x.valid_to, coalesce(x.total_sales_sar, 0), coalesce(x.total_discount_sar, 0),
    coalesce(x.active, true), coalesce(x.expired, false),
    x.promo_type, x.discount_type, x.discount, x.product, x.status, x.client_name, x.payments_created_at, x.payments_created_by, v_seen
  from _pr_in x where x.kind is not null
    and not exists (select 1 from public.promo_codes t where lower(btrim(t.code)) = x.code_norm);
  get diagnostics n_new = row_count;

  return jsonb_build_object('codes_in_file', n_in, 'codes_new', n_new, 'codes_changed', n_changed,
    'codes_same', n_in - n_new - n_changed - n_no_type, 'codes_no_type', n_no_type);
end;
$function$;
revoke all on function public.fn_promo_codes_import(jsonb, timestamptz, text) from public, anon;
grant execute on function public.fn_promo_codes_import(jsonb, timestamptz, text) to authenticated;
