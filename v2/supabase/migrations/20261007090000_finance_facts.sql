-- v2 finance, part 1 (P4-1 with the owner's money rules of 5 Oct): the money facts as Direct Payments shapes them —
-- invoices of five kinds with their lines, the links from a billing invoice to its transactions, the expenses (never on
-- a billing invoice) and the tax invoice (DPIN) — each with one home and no revenue, cost, profit or VAT column (M1,
-- V615); the Finance lists they read (status words, expense status words, services, products with "no supplier cost",
-- wallet rules, commission words, channels) and the exclusion rules; a month's close and its snapshot (V610); the
-- credit split a Commercial tag writes (V613). An invoice's match keys are folded like every identifier (§3.5).
-- TECH-SPEC §3.6; V1, V64, V401, V500, V610, V611, V613, V615, V616, V617; D16, D21, D23, D24. Collections, receipts,
-- partner credit and wallets come later (the architect's order of 7 Oct). Forward-only (V103).

create schema finance;   -- the money facts, their lists and (P4-2) the views every figure comes from
revoke all on schema finance from public;

-- ================================================================ the Finance lists (§3.0 LIST, §3.6)
-- Each is a setting list on Settings → Finance (admins — V97), edited through the list door.

-- The Payments invoice status words (§3.6, V610): what each means and whether it carries the Audit Required flag. A
-- word on no entry holds the row (D21): an import never guesses it.
create table finance.status_map (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  word text not null check (pg_catalog.btrim(word) <> '' and pg_catalog.length(word) <= 80),
  maps_to text not null check (maps_to in ('paid', 'pending', 'draft', 'void', 'cancelled')),
  audit_required boolean not null default false,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index status_map_one_word on finance.status_map (norm.fold(word)) where deleted_at is null;
comment on table finance.status_map is 'The Payments invoice status words (§3.6, V610): Fully Paid and Fully Paid as receivable → paid; Fully Paid (Audit Required) → paid, flagged; an unknown word holds the row (D21).';

-- The expense status words (V611): Pending · Under Review · Approved · Cancelled · Rejected, and "issued" — what a blank
-- transaction-level expense status in an export means (done, Ready; never "not ready").
create table finance.expense_status_word (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  word text not null check (pg_catalog.btrim(word) <> '' and pg_catalog.length(word) <= 80),
  maps_to text not null check (maps_to in ('approved', 'pending', 'under_review', 'cancelled', 'rejected', 'issued')),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index expense_status_word_one_word on finance.expense_status_word (norm.fold(word)) where deleted_at is null;
comment on table finance.expense_status_word is 'The expense status words of a Payments export (V611); a blank transaction-level status reads issued.';

-- The main services an invoice line belongs to (D24); a service that is not income (wallet top-ups) is shown apart.
create table finance.service (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  counts_as_income boolean not null default true,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table finance.service is 'The main services (D24), each counting as income or not.';

-- The Payments products, each → its service, whether it is a commission, and whether it never carries a supplier cost
-- (V611: a unit whose every product has it is Ready at cost 0 with no expense — which products is Q48; none is set
-- until the owner answers).
create table finance.product (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  word text check (word is null or (pg_catalog.btrim(word) <> '' and pg_catalog.length(word) <= 120)),  -- as Payments spells it
  service_id uuid references finance.service (id),
  commission boolean not null default false,
  no_supplier_cost boolean not null default false,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index product_one_word on finance.product (norm.fold(coalesce(word, name_en))) where deleted_at is null;
comment on table finance.product is 'The Payments products (§3.6), each → a service (D24), a commission flag and no_supplier_cost (V611, Q48).';

-- What makes a line a wallet top-up (MF7): its product, or a word in its name (the English and the Arabic names).
create table finance.wallet_rule (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  kind text not null check (kind in ('product', 'name_contains')),
  product_id uuid references finance.product (id),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check ((kind = 'product') = (product_id is not null))
);
comment on table finance.wallet_rule is 'What identifies a wallet top-up line (MF7): a product, or a word its name contains.';

-- A word that makes an invoice a commission when a line's name carries it (in either language).
create table finance.commission_word (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table finance.commission_word is 'A line whose name carries one of these words (English or Arabic) makes its invoice a commission.';

-- The channel a transaction came through (V613): Commercial · Direct · Promo. Only a channel that credits its owner
-- credits a person for an individual's unit (Commercial).
create table finance.channel (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  credits_owner boolean not null default false,
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table finance.channel is 'The channel of a transaction (V613): Commercial · Direct · Promo; only Commercial credits a person for an individual.';

-- The exclusion rules (D16): a row they catch is never counted (exclude — listed apart with its rule and reason) or never
-- shown (hide — verification products, MF5). A name rule applies only to rows carrying no client ID (V412); a VAT/CR rule
-- catches every row matched to the organisation holding it (V413). Exclusions win over everything and apply to past rows
-- at once — they are read live, never copied.
create table finance.exclusion_rule (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client_id', 'name', 'tax_no', 'discount_code', 'invoice', 'product', 'partner')),
  value_raw text not null check (pg_catalog.btrim(value_raw) <> '' and pg_catalog.length(value_raw) <= 300),
  value_key text not null,
  mode text not null default 'exclude' check (mode in ('exclude', 'hide')),
  reason text not null check (pg_catalog.btrim(reason) <> '' and pg_catalog.length(reason) <= 500),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index exclusion_rule_once on finance.exclusion_rule (kind, value_key) where deleted_at is null;
comment on table finance.exclusion_rule is 'D16: rows never counted (exclude) or never shown (hide); a name rule only where the row has no client ID (V412).';

create function finance.exclusion_key() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.value_key := case new.kind
                     when 'client_id' then norm.digits_key(new.value_raw, true)
                     when 'tax_no' then norm.digits_key(new.value_raw)
                     when 'discount_code' then norm.code_key(new.value_raw)
                     when 'name' then norm.name_key(new.value_raw, partner.stop_words())
                     else norm.fold(new.value_raw) end;
  if new.value_key is null or new.value_key = '' then
    raise exception using errcode = 'P0001', message = 'finance.exclusion_value_empty';
  end if;
  return new;
end
$$;
create trigger key before insert or update of kind, value_raw on finance.exclusion_rule
  for each row execute function finance.exclusion_key();

-- ================================================================ the facts (§3.6)
-- One invoice as Payments records it: five kinds; the customer as Payments shows it with its match keys (never a partner —
-- the match is live, §3.5); the status word and what it means; the transaction's consolidation status kept apart and never read as
-- payment; the dates — its month is its created date (V610, `month_on`); the total as recorded (V615); the channel
-- (V613); where the row came from and the day its figures were read from Payments (V401); Provisional or Final (V500).
create table finance.invoice (
  id uuid primary key default gen_random_uuid(),
  ref text not null check (pg_catalog.btrim(ref) <> '' and pg_catalog.length(ref) <= 60),
  kind text not null check (kind in ('transaction', 'standalone', 'billing', 'credit_note', 'wallet_topup')),
  customer_name text check (customer_name is null or pg_catalog.length(customer_name) <= 300),
  customer_name2 text check (customer_name2 is null or pg_catalog.length(customer_name2) <= 300),
  customer_email text check (customer_email is null or pg_catalog.length(customer_email) <= 300),
  customer_phone text check (customer_phone is null or pg_catalog.length(customer_phone) <= 60),
  client_id_raw text check (client_id_raw is null or pg_catalog.length(client_id_raw) <= 60),
  tax_no_raw text check (tax_no_raw is null or pg_catalog.length(tax_no_raw) <= 60),
  discount_code_raw text check (discount_code_raw is null or pg_catalog.length(discount_code_raw) <= 60),
  name_key text, name2_key text, email_key text, phone_key text, client_id_key text, tax_key text, code_key text,
  norm_version int,
  status_raw text check (status_raw is null or pg_catalog.length(status_raw) <= 80),
  status_id uuid references finance.status_map (id),
  status_at timestamptz,
  consolidation_status_raw text check (consolidation_status_raw is null or pg_catalog.length(consolidation_status_raw) <= 80),
  expense_status text check (expense_status in ('approved', 'pending', 'under_review', 'cancelled', 'rejected', 'issued')),
  expense_status_raw text check (expense_status_raw is null or pg_catalog.length(expense_status_raw) <= 80),
  created_on date not null,
  month_on date generated always as (pg_catalog.date_trunc('month', created_on::timestamp)::date) stored,
  generated_on date,
  paid_on date,
  due_on date,
  total_sar numeric(14, 2),
  product_id uuid references finance.product (id),
  product_raw text check (product_raw is null or pg_catalog.length(product_raw) <= 120),
  branch text check (branch is null or pg_catalog.length(branch) <= 120),
  salesman_raw text check (salesman_raw is null or pg_catalog.length(salesman_raw) <= 200),
  segment_id uuid references partner.side_type (id),
  channel_id uuid references finance.channel (id),
  source text not null default 'manual' check (source in ('manual', 'import')),
  src jsonb check (src is null or pg_catalog.jsonb_typeof(src) = 'object'),
  first_batch_id uuid,
  last_batch_id uuid,
  payments_as_of date not null default core.riyadh_today(),
  figure_state text not null default 'provisional' check (figure_state in ('provisional', 'final')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index invoice_ref on finance.invoice (ref) where deleted_at is null;
create index invoice_month on finance.invoice (month_on) where deleted_at is null;
create index invoice_keys on finance.invoice (client_id_key, tax_key, code_key, email_key) where deleted_at is null;
comment on table finance.invoice is 'One Payments invoice (§3.6): transaction, standalone, billing, credit note or wallet top-up; its customer as Payments shows it, with match keys — never a partner. No revenue, cost, profit or VAT column (M1, V615).';
comment on column finance.invoice.month_on is 'V610: the month a unit belongs to is its created date''s.';
comment on column finance.invoice.consolidation_status_raw is 'The transaction''s consolidation status in Payments (e.g. consolidation_invoiced) — never read as the payment status.';
comment on column finance.invoice.expense_status is 'The transaction-level expense status from the expense export, through finance.expense_status_word; blank in the file reads issued (V611).';
comment on column finance.invoice.payments_as_of is 'The day these figures were read from Payments (V401): shown as "Payments · as of".';

create table finance.invoice_line (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references finance.invoice (id),
  line_no int not null check (line_no between 1 and 500),
  product_id uuid references finance.product (id),
  product_raw text check (product_raw is null or pg_catalog.length(product_raw) <= 120),
  name text not null check (pg_catalog.btrim(name) <> '' and pg_catalog.length(name) <= 500),
  qty numeric(12, 3) not null default 1,
  unit_price numeric(14, 2),
  discount_sar numeric(14, 2) not null default 0,
  taxable boolean not null default true,
  total_sar numeric(14, 2) not null,
  service_id uuid references finance.service (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index invoice_line_once on finance.invoice_line (invoice_id, line_no) where deleted_at is null;

-- A billing invoice gathers its transactions; a transaction belongs to one billing invoice at most (§3.6). From Payments'
-- consolidation field (`payments`), typed by a person (`person`), or an amount proposal a person ticked (`proposal`, V616)
-- — never by matching line names.
create table finance.billing_link (
  id uuid primary key default gen_random_uuid(),
  billing_invoice_id uuid not null references finance.invoice (id),
  transaction_invoice_id uuid not null references finance.invoice (id),
  source text not null default 'person' check (source in ('payments', 'person', 'proposal')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (billing_invoice_id <> transaction_invoice_id)
);
create unique index billing_link_one_billing on finance.billing_link (transaction_invoice_id) where deleted_at is null;

-- An amount proposal (V616, §3.11.8): a billing invoice without Payments' consolidation field, whose total one set of
-- unlinked transactions of the same customer adds up to exactly. It links nothing until a person ticks it.
create table finance.billing_proposal (
  id uuid primary key default gen_random_uuid(),
  billing_invoice_id uuid not null references finance.invoice (id),
  transaction_ids uuid[] not null check (pg_catalog.cardinality(transaction_ids) between 1 and 6),
  amount_sar numeric(14, 2) not null,
  state text not null default 'open' check (state in ('open', 'ticked', 'dismissed')),
  decided_at timestamptz, decided_by uuid references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index billing_proposal_open on finance.billing_proposal (billing_invoice_id)
  where deleted_at is null and state = 'open';
comment on table finance.billing_proposal is 'V616: an amount proposal linking a billing invoice to its transactions; a person ticks it — never by line names.';

-- The expenses on a transaction or a standalone invoice — never on a billing invoice (§3.6). Cost = the approved (and
-- issued) ones only (V611); an approved expense has its amount.
create table finance.expense_line (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references finance.invoice (id),
  line_key text,                                            -- ref + expense type + created-at, for imports
  expense_type text not null check (pg_catalog.btrim(expense_type) <> '' and pg_catalog.length(expense_type) <= 120),
  status text not null check (status in ('approved', 'pending', 'under_review', 'cancelled', 'rejected', 'issued')),
  status_raw text check (status_raw is null or pg_catalog.length(status_raw) <= 80),
  amount_sar numeric(14, 2),                                -- null while pending
  merchant text check (merchant is null or pg_catalog.length(merchant) <= 300),
  id_reference text check (id_reference is null or pg_catalog.length(id_reference) <= 120),
  created_at_src timestamptz,
  submitted_at timestamptz,
  decided_at timestamptz,
  submitter text check (submitter is null or pg_catalog.length(submitter) <= 200),
  approver text check (approver is null or pg_catalog.length(approver) <= 200),
  source text not null default 'manual' check (source in ('manual', 'import')),
  src jsonb check (src is null or pg_catalog.jsonb_typeof(src) = 'object'),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint expense_approved_has_amount check (status not in ('approved', 'issued') or amount_sar is not null)
);
create unique index expense_line_key on finance.expense_line (line_key) where line_key is not null and deleted_at is null;

-- The tax invoice (DPIN, V617: its own number, never the transaction's): a child of a billing or a standalone invoice;
-- its total feeds the checks only (P4-2), never a figure.
create table finance.tax_invoice (
  id uuid primary key default gen_random_uuid(),
  dpin text not null check (pg_catalog.btrim(dpin) <> '' and pg_catalog.length(dpin) <= 60),
  parent_invoice_id uuid not null references finance.invoice (id),
  total_sar numeric(14, 2),
  issued_on date,
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index tax_invoice_dpin on finance.tax_invoice (dpin) where deleted_at is null;
create unique index tax_invoice_one_per_parent on finance.tax_invoice (parent_invoice_id) where deleted_at is null;

-- Who is credited with a unit when it is not its account manager (§3.6): shares that sum to 1. A Commercial tag on an
-- individual's unit writes a one-share split naming the person (V613).
create table finance.credit_split (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references finance.invoice (id),
  person_id uuid not null references core.person (id),
  share numeric(7, 6) not null check (share > 0 and share <= 1),
  note text not null check (pg_catalog.btrim(note) <> '' and pg_catalog.length(note) <= 500),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index credit_split_once on finance.credit_split (invoice_id, person_id) where deleted_at is null;

-- A closed month (V610): its snapshot — each counted unit's ref, revenue, cost and cost status as at close — never
-- changes; every later difference is listed by finance.late_change, never folded in. Who closes and when is Q47: until
-- answered, a person with Full on Finance closes it by hand.
create table finance.month_close (
  id uuid primary key default gen_random_uuid(),
  month date not null check (month = pg_catalog.date_trunc('month', month)::date),
  closed_on date not null default core.riyadh_today(),
  closed_by uuid not null references core.person (id),
  snapshot jsonb not null check (pg_catalog.jsonb_typeof(snapshot) = 'array'),
  note text check (note is null or pg_catalog.length(note) <= 2000),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index month_close_once on finance.month_close (month) where deleted_at is null;
comment on table finance.month_close is 'V610: a closed month and its snapshot, which never changes (Q47: closed by hand by Full on Finance).';

create function finance.month_close_fixed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.snapshot is distinct from old.snapshot or new.month is distinct from old.month then
    raise exception using errcode = 'P0001', message = 'finance.snapshot_never_changes';
  end if;
  return new;
end
$$;
create trigger fixed before update on finance.month_close for each row execute function finance.month_close_fixed();

-- ================================================================ which part goes on which kind (§3.6)
-- Expenses: transactions and standalone invoices. A DPIN: billing and standalone invoices. A billing link or proposal: a
-- billing invoice to transactions.
create function finance.kind_allows(p_kind text, p_part text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case p_part
           when 'expense' then p_kind in ('transaction', 'standalone')
           when 'dpin' then p_kind in ('billing', 'standalone')
           when 'billing' then p_kind = 'billing'
           when 'billed' then p_kind = 'transaction'
           else true end
$$;

create function finance.part_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  part text := TG_ARGV[0];
  k text;
begin
  if TG_OP = 'UPDATE' and new.deleted_at is not null then
    return new;
  end if;
  if part = 'link' then
    select i.kind into k from finance.invoice i where i.id = new.billing_invoice_id;
    if not finance.kind_allows(k, 'billing') then
      raise exception using errcode = 'P0001', message = 'finance.links_only_on_billing', detail = k;
    end if;
    select i.kind into k from finance.invoice i where i.id = new.transaction_invoice_id;
    if not finance.kind_allows(k, 'billed') then
      raise exception using errcode = 'P0001', message = 'finance.only_transactions_are_billed',
        detail = (select i.ref from finance.invoice i where i.id = new.transaction_invoice_id);
    end if;
    return new;
  end if;
  select i.kind into k from finance.invoice i
  where i.id = (pg_catalog.to_jsonb(new) ->> case part when 'dpin' then 'parent_invoice_id' else 'invoice_id' end)::uuid;
  if not finance.kind_allows(k, part) then
    raise exception using errcode = 'P0001',
      message = case part when 'expense' then 'finance.no_expenses_on_' || k else 'finance.' || part || '_not_on_' || k end,
      detail = k;
  end if;
  return new;
end
$$;
create trigger kind before insert or update on finance.expense_line for each row execute function finance.part_guard('expense');
create trigger kind before insert or update on finance.tax_invoice for each row execute function finance.part_guard('dpin');
create trigger kind before insert or update on finance.billing_link for each row execute function finance.part_guard('link');

-- An invoice's kind changes only where its parts allow the new one; its match keys are folded like every identifier
-- (§3.5); its segment is a Client-side type (V64, V98); a Final figure changes only with a reason (V500).
create function finance.invoice_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  stop text[] := partner.stop_words();
  part text;
begin
  if TG_OP = 'UPDATE' and new.kind is distinct from old.kind then
    select x.part into part from (
      select 'expense' as part where exists (select 1 from finance.expense_line e where e.invoice_id = new.id and e.deleted_at is null)
      union all select 'dpin' where exists (select 1 from finance.tax_invoice t where t.parent_invoice_id = new.id and t.deleted_at is null)
      union all select 'billing' where exists (select 1 from finance.billing_link l where l.billing_invoice_id = new.id and l.deleted_at is null)
      union all select 'billed' where exists (select 1 from finance.billing_link l where l.transaction_invoice_id = new.id and l.deleted_at is null)
    ) x where not finance.kind_allows(new.kind, x.part) limit 1;
    if part is not null then
      raise exception using errcode = 'P0001', message = 'finance.kind_conflicts', detail = part;
    end if;
  end if;
  -- V461: no date in the future, refused at write (an import holds such a row before it gets here).
  if (TG_OP = 'INSERT' or (new.created_on, new.paid_on, new.generated_on) is distinct from (old.created_on, old.paid_on, old.generated_on))
     and greatest(new.created_on, new.paid_on, new.generated_on) > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'finance.date_in_future', detail = new.ref;
  end if;
  if TG_OP = 'UPDATE' and old.figure_state = 'final'
     and (new.total_sar, new.status_id, new.created_on, new.paid_on)
         is distinct from (old.total_sar, old.status_id, old.created_on, old.paid_on)
     and pg_catalog.btrim(coalesce((select r.reason from audit.request r
                                    where r.id = nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid), '')) = '' then
    raise exception using errcode = 'P0001', message = 'finance.final_needs_reason', detail = new.ref;
  end if;
  if new.segment_id is not null
     and not exists (select 1 from partner.side_type t where t.id = new.segment_id and t.side = 'client') then
    raise exception using errcode = 'P0001', message = 'finance.segment_is_a_client_type';
  end if;
  new.name_key := norm.name_key(new.customer_name, stop);
  new.name2_key := norm.name_key(new.customer_name2, stop);
  new.email_key := norm.email_key(new.customer_email);
  new.phone_key := norm.phone_key(new.customer_phone);
  new.client_id_key := norm.digits_key(new.client_id_raw, true);
  new.tax_key := norm.digits_key(new.tax_no_raw);
  new.code_key := norm.code_key(new.discount_code_raw);
  new.norm_version := norm.version();
  return new;
end
$$;
create trigger guard before insert or update on finance.invoice for each row execute function finance.invoice_guard();

-- ================================================================ owners (V127)
-- An invoice is owned by the person who entered it (Own on Finance: entering invoices and editing your own — owner
-- decision 4; an imported one by Import, V44); its parts by its owner.
create function finance.invoice_owner_of(p_table text, p_id uuid) returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query execute pg_catalog.format(
    'select i.created_by from %s x join finance.invoice i on i.id = x.%I where x.id = $1',
    pg_catalog.to_regclass(p_table),
    case p_table when 'finance.billing_link' then 'billing_invoice_id' when 'finance.billing_proposal' then 'billing_invoice_id'
                 when 'finance.tax_invoice' then 'parent_invoice_id' else 'invoice_id' end)
    using p_id;
end
$$;
create function finance.invoice_line_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.invoice_line', p_id) $$;
create function finance.billing_link_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.billing_link', p_id) $$;
create function finance.billing_proposal_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.billing_proposal', p_id) $$;
create function finance.expense_line_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.expense_line', p_id) $$;
create function finance.tax_invoice_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.tax_invoice', p_id) $$;
create function finance.credit_split_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select finance.invoice_owner_of('finance.credit_split', p_id) $$;

do $$
declare
  t text;
begin
  foreach t in array array['finance.status_map', 'finance.expense_status_word', 'finance.service', 'finance.product',
                           'finance.wallet_rule', 'finance.commission_word', 'finance.channel', 'finance.exclusion_rule',
                           'finance.invoice', 'finance.invoice_line', 'finance.billing_link', 'finance.billing_proposal',
                           'finance.expense_line', 'finance.tax_invoice', 'finance.credit_split', 'finance.month_close'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('finance');

-- ================================================================ the starting lists (generic words; admins adjust)
select audit.begin('system', 'finance.lists_seeded');
insert into finance.status_map (key, name_en, name_ar, word, maps_to, audit_required, sort, created_by) values
  ('fully_paid', 'Fully Paid', 'مدفوعة بالكامل', 'Fully Paid', 'paid', false, 10, core.system_person_id()),
  ('fully_paid_receivable', 'Fully Paid as receivable', 'مدفوعة بالكامل كذمة مدينة', 'Fully Paid as receivable', 'paid', false, 15,
   core.system_person_id()),
  ('fully_paid_audit', 'Fully Paid (Audit Required)', 'مدفوعة بالكامل (تتطلب التدقيق)', 'Fully Paid (Audit Required)', 'paid', true, 20,
   core.system_person_id()),
  ('published', 'Published', 'منشورة', 'Published', 'pending', false, 25, core.system_person_id()),
  ('pending', 'Pending', 'معلقة', 'Pending', 'pending', false, 30, core.system_person_id()),
  ('pending_payment', 'Pending Payment', 'بانتظار الدفع', 'Pending Payment', 'pending', false, 40, core.system_person_id()),
  ('partially_paid', 'Partially Paid', 'مدفوعة جزئيا', 'Partially Paid', 'pending', false, 50, core.system_person_id()),
  ('draft', 'Draft', 'مسودة', 'Draft', 'draft', false, 60, core.system_person_id()),
  ('void', 'Void', 'باطلة', 'Void', 'void', false, 70, core.system_person_id()),
  ('voided', 'Voided', 'أُبطلت', 'Voided', 'void', false, 80, core.system_person_id()),
  ('cancelled', 'Cancelled', 'ملغاة', 'Cancelled', 'cancelled', false, 90, core.system_person_id()),
  ('canceled', 'Canceled', 'ملغاة', 'Canceled', 'cancelled', false, 100, core.system_person_id());
insert into finance.expense_status_word (key, name_en, name_ar, word, maps_to, sort, created_by) values
  ('approved', 'Approved', 'معتمد', 'Approved', 'approved', 10, core.system_person_id()),
  ('pending', 'Pending', 'معلق', 'Pending', 'pending', 20, core.system_person_id()),
  ('under_review', 'Under Review', 'قيد المراجعة', 'Under Review', 'under_review', 30, core.system_person_id()),
  ('cancelled', 'Cancelled', 'ملغى', 'Cancelled', 'cancelled', 40, core.system_person_id()),
  ('rejected', 'Rejected', 'مرفوض', 'Rejected', 'rejected', 50, core.system_person_id()),
  ('issued', 'Issued', 'صادر', 'Issued', 'issued', 60, core.system_person_id());
insert into finance.service (key, name_en, name_ar, counts_as_income, sort, created_by) values
  ('flights', 'Flights', 'الطيران', true, 10, core.system_person_id()),
  ('hotels', 'Hotels', 'الفنادق', true, 20, core.system_person_id()),
  ('visas', 'Visas', 'التأشيرات', true, 30, core.system_person_id()),
  ('transport', 'Transport', 'النقل', true, 40, core.system_person_id()),
  ('packages', 'Packages', 'الباقات', true, 50, core.system_person_id()),
  ('insurance', 'Insurance', 'التأمين', true, 60, core.system_person_id()),
  ('other', 'Other services', 'خدمات أخرى', true, 90, core.system_person_id()),
  ('wallet', 'Wallet top-ups', 'شحن المحفظة', false, 100, core.system_person_id());
insert into finance.product (key, name_en, name_ar, word, service_id, commission, sort, created_by)
select x.key, x.name_en, x.name_ar, x.word, s.id, false, x.sort, core.system_person_id()
from (values ('flights', 'Flights', 'الطيران', 'Direct Flights', 'flights', 10),
             ('hotels', 'Hotels', 'الفنادق', 'Direct Hotels', 'hotels', 20),
             ('visas', 'Visas', 'التأشيرات', 'Direct Visas', 'visas', 30),
             ('transport', 'Transport', 'النقل', 'Direct Transport', 'transport', 40),
             ('packages', 'Packages', 'الباقات', 'Direct Packages', 'packages', 50),
             ('insurance', 'Insurance', 'التأمين', 'Direct Insurance', 'insurance', 60),
             ('wallet_topup', 'Wallet top-up', 'شحن المحفظة', 'Wallet Top-up', 'wallet', 100)) x(key, name_en, name_ar, word, service, sort)
join finance.service s on s.key = x.service;
insert into finance.wallet_rule (key, name_en, name_ar, kind, product_id, sort, created_by)
select 'wallet_product', 'Wallet top-up', 'شحن المحفظة', 'product', p.id, 10, core.system_person_id()
from finance.product p where p.key = 'wallet_topup';
insert into finance.wallet_rule (key, name_en, name_ar, kind, sort, created_by)
values ('wallet_word', 'Wallet', 'محفظة', 'name_contains', 20, core.system_person_id());
insert into finance.commission_word (key, name_en, name_ar, sort, created_by)
values ('commission', 'Commission', 'عمولة', 10, core.system_person_id());
insert into finance.channel (key, name_en, name_ar, credits_owner, sort, created_by) values
  ('commercial', 'Commercial', 'التجاري', true, 10, core.system_person_id()),
  ('direct', 'Direct', 'مباشر', false, 20, core.system_person_id()),
  ('promo', 'Promo', 'ترويجي', false, 30, core.system_person_id());
select audit.end();
