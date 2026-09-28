-- D1 — the money model and the invoice import (oversight-reviewed plan of 27–28 Sep; DECISIONS D21). Rollback:
-- d1-money-model.rollback.sql. Nothing here creates a business record (D17): every table starts empty; the item-name list is
-- typed by a person on Finance → Rules.
--
-- 1. Revenue = the invoice total as Payments records it. The only part taken out is a WALLET TOP-UP part — the "Direct
--    Wallet / Wallet Balance" item lines, money put into the wallet, not a sale — kept in wallet_portion_sar. A sale paid
--    FROM the wallet is a full sale (the wallet shows only as a payment receipt, never as a line, so nothing is subtracted).
--    A top-up-only invoice is its own row kind and never counts.
-- 2. Cost = approved expenses only (the owner's rule). A missing cost is EMPTY (null), never 0 — so a row with no cost is
--    "cost missing", never 100% profit. Profit is empty when cost is. A commission row carries no cost by nature: its profit
--    is its revenue.
-- 3. The invoice's own item lines are stored (finance_invoice_lines) and the pass-through amount on them (lines whose name a
--    person has classed "pass-through" on the Rules tab) is SHOWN beside the cost, labelled — it never enters cost or profit
--    (DECISIONS: the item split is a VAT split, not cost — owner, 22 Aug; a fallback waits on the owner's own answer).
-- 4. A billing invoice that re-bills transactions already imported is a LINK row: zero revenue, never counted; a person
--    confirms the link in the import preview (KB 04: "the DPIN row is a link record with zero revenue").
-- 5. WHICH DATE SETS THE MONTH (oversight, 28 Sep): the paid date for a paid invoice, else the date it was created. That date
--    is invoice_date, so every total, report, KPI and year (a generated column) follows it with no second rule; the creation
--    date is kept beside it (invoice_created_on) and Performance can regroup by it.
-- 6. Payments' own status and its time, the paid date, the tax-invoice date, "Fully Paid (Audit Required)" as a flag, and
--    where each row came from (import / manual) are kept.
-- 7. An import fills and never wipes: an update writes only the fields the new file carries; a blank never erases a value.

-- =====================================================================
-- 1. columns
-- =====================================================================
alter table public.finance_invoices
  add column if not exists row_kind text not null default 'sale',
  add column if not exists payments_status text,
  add column if not exists payments_status_at timestamptz,
  add column if not exists paid_at date,
  add column if not exists tax_invoice_date date,
  add column if not exists invoice_created_on date,    -- Payments' "Invoice Create Date"; invoice_date is the date that sets the month
  add column if not exists audit_required boolean not null default false,
  add column if not exists customer_email text,
  add column if not exists billed_by_ref text,          -- on a transaction: the billing invoice that re-bills it
  add column if not exists source text not null default 'import';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'finance_invoices_row_kind_check') then
    alter table public.finance_invoices add constraint finance_invoices_row_kind_check
      check (row_kind in ('sale', 'wallet_topup', 'billing_link', 'credit_note'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_invoices_source_check') then
    alter table public.finance_invoices add constraint finance_invoices_source_check check (source in ('import', 'manual'));
  end if;
end $$;
-- a missing cost is empty, not 0; profit follows
alter table public.finance_invoices alter column cost_sar drop not null, alter column cost_sar drop default,
                                    alter column profit_sar drop not null, alter column profit_sar drop default;

-- =====================================================================
-- 2. the derive trigger — revenue, profit, month and quarter, every insert and update
-- =====================================================================
create or replace function public.finance_derive_fields() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  new.month := to_char(new.invoice_date, 'FMMonth');
  new.quarter := 'Q' || to_char(new.invoice_date, 'Q');
  -- a row that carries a revenue but no total (a hand-entered line, an older writer) keeps its revenue: the total is taken
  -- from it, so nothing entered is ever rewritten to 0
  if new.total_incl_vat_sar is null then
    new.total_incl_vat_sar := coalesce(new.revenue_sar, 0) + coalesce(new.wallet_portion_sar, 0);
  end if;
  if new.row_kind in ('wallet_topup', 'billing_link') then
    new.revenue_sar := 0;                                          -- never a sale
  else
    new.revenue_sar := round(coalesce(new.total_incl_vat_sar, 0) - coalesce(new.wallet_portion_sar, 0), 2);
  end if;
  if new.cost_sar is null then
    new.profit_sar := case when new.revenue_way = 'commission' then new.revenue_sar else null end;   -- cost missing → no profit
  else
    new.profit_sar := round(new.revenue_sar - new.cost_sar, 2);
  end if;
  if new.integrity_status in ('excluded', 'credit_note') then
    new.amount_remaining_sar := 0;
  end if;
  return new;
end $function$;

-- =====================================================================
-- 3. the item-name list (typed by a person) and the invoice item lines
-- =====================================================================
create table if not exists public.money_item_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                   -- the item name's last part, as Payments writes it ("3rd Party Fee")
  name_norm text generated always as (public.money_norm(name)) stored,
  class text not null check (class in ('pass_through', 'fee')),
  note text,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  updated_by uuid, updated_by_name text, updated_at timestamptz,
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint money_item_class_readable check (public.money_norm(name) is not null));
create unique index if not exists money_item_classes_one_live on public.money_item_classes (name_norm) where removed_at is null;

create or replace function public.money_item_classes_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare who uuid := coalesce(auth.uid(), public.qa_user_id());
        nm text := (select coalesce(nullif(u.full_name, ''), u.email) from app_users u where u.id = coalesce(auth.uid(), public.qa_user_id()));
begin
  if tg_op = 'INSERT' then
    new.name := btrim(new.name); new.created_by := who; new.created_by_name := nm; new.created_at := now();
    new.updated_by := null; new.updated_by_name := null; new.updated_at := null;
    new.removed_by := null; new.removed_by_name := null; new.removed_at := null; return new; end if;
  if old.removed_at is not null then raise exception 'A removed item name stays removed — add it again if it is needed'; end if;
  if new.name is distinct from old.name or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or new.created_by_name is distinct from old.created_by_name then
    raise exception 'An item name never changes — remove it and add it again'; end if;
  if new.removed_at is not null then new.removed_at := now(); new.removed_by := who; new.removed_by_name := nm; end if;
  new.updated_at := now(); new.updated_by := who; new.updated_by_name := nm;
  return new;
end $$;
drop trigger if exists money_item_classes_guard on public.money_item_classes;
create trigger money_item_classes_guard before insert or update on public.money_item_classes for each row execute function public.money_item_classes_guard();
drop trigger if exists money_item_classes_no_delete on public.money_item_classes;
create trigger money_item_classes_no_delete before delete on public.money_item_classes for each row execute function public.block_hard_delete();
drop trigger if exists trg_record_history on public.money_item_classes;
create trigger trg_record_history after insert or update or delete on public.money_item_classes for each row execute function public.record_history_write();
alter table public.money_item_classes enable row level security;
drop policy if exists money_item_classes_read on public.money_item_classes;
create policy money_item_classes_read on public.money_item_classes for select to authenticated using (public.can_see_page('finance'));
drop policy if exists money_item_classes_insert on public.money_item_classes;
create policy money_item_classes_insert on public.money_item_classes for insert to authenticated
  with check (public.app_role() in ('admin', 'manager') and public.can_edit_page('finance'));
drop policy if exists money_item_classes_update on public.money_item_classes;
create policy money_item_classes_update on public.money_item_classes for update to authenticated
  using (public.app_role() in ('admin', 'manager') and public.can_edit_page('finance'))
  with check (public.app_role() in ('admin', 'manager') and public.can_edit_page('finance'));
revoke all on public.money_item_classes from anon;
grant select, insert, update on public.money_item_classes to authenticated;

-- the item lines of an imported invoice, replaced per invoice on each import of that invoice (import rule 4)
create table if not exists public.finance_invoice_lines (
  id bigserial primary key,
  invoice_no text not null,
  line_no int not null,
  kind text,                       -- 'item' | 'group' as the export writes it
  product text, name text,
  qty numeric, unit_price numeric, discount_sar numeric, taxable boolean, item_total_sar numeric,
  source_batch text, created_at timestamptz not null default now(),
  unique (invoice_no, line_no));
create index if not exists finance_invoice_lines_invoice on public.finance_invoice_lines (invoice_no);
alter table public.finance_invoice_lines enable row level security;
drop policy if exists finance_invoice_lines_read on public.finance_invoice_lines;
create policy finance_invoice_lines_read on public.finance_invoice_lines for select to authenticated using (public.can_see_page('finance'));
drop policy if exists finance_invoice_lines_write on public.finance_invoice_lines;
create policy finance_invoice_lines_write on public.finance_invoice_lines for all to authenticated
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
revoke all on public.finance_invoice_lines from anon;
grant select, insert, update, delete on public.finance_invoice_lines to authenticated;
grant usage, select on sequence public.finance_invoice_lines_id_seq to authenticated;

-- the last part of an item name ("Flight Booking - 3rd Party Fee" → "3rd Party Fee"), which is what a person classes
create or replace function public.money_item_key(n text) returns text language sql immutable parallel safe as $$
  select public.money_norm(btrim(regexp_replace(coalesce(n, ''), '^.*\s[-–—|]\s', '')))
$$;

-- per invoice: what its lines say is pass-through, fee, and not yet classed — read live, so a change to the list applies at once
create or replace view public.money_line_totals with (security_invoker = on) as
select l.invoice_no,
       sum(l.item_total_sar) filter (where c.class = 'pass_through') as pass_through_sar,
       sum(l.item_total_sar) filter (where c.class = 'fee') as fee_sar,
       sum(l.item_total_sar) filter (where c.class is null) as unclassed_sar,
       count(*) filter (where c.class is null) as unclassed_lines
from public.finance_invoice_lines l
left join public.money_item_classes c on c.removed_at is null and c.name_norm = public.money_item_key(l.name)
where coalesce(l.kind, 'item') = 'item'
group by l.invoice_no;
grant select on public.money_line_totals to authenticated;
revoke all on public.money_line_totals from anon;

-- =====================================================================
-- 4. what counts — the E view, now also: a sale only (top-ups and billing links never count), and the new facts appended
--    (columns can only be added at the end of a view that is replaced in place)
-- =====================================================================
create or replace view public.money_rows with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, i.customer_raw_name, i.payments_client_id, i.discount_code,
       i.transaction_ref, i.integrity_status, i.revenue_way,
       i.revenue_sar, i.cost_sar, i.profit_sar, i.amount_received_sar, i.amount_remaining_sar, i.collection_due_date,
       i.source_batch,
       m.business_id, m.company_key, m.company_name, m.merge_state, m.profile_type,
       m.rule_id, m.rule_kind, m.rule_value, m.rule_reason,
       (m.rule_id is not null or i.exclusion_reason is not null) as excluded,
       (m.rule_id is null and i.exclusion_reason is null and i.integrity_status = 'verified_paid' and i.row_kind = 'sale') as counts,
       case when m.rule_id is null and i.exclusion_reason is null and coalesce(i.amount_remaining_sar, 0) > 0
            then greatest(0, current_date - coalesce(i.collection_due_date, i.invoice_date)) end as open_age_days,
       i.row_kind, i.payments_status, i.paid_at, i.tax_invoice_date, i.invoice_created_on, i.audit_required, i.source, i.billed_by_ref,
       (i.cost_sar is null and i.revenue_way is distinct from 'commission') as cost_missing,
       (i.cost_sar is not null and i.cost_sar > i.revenue_sar) as loss,
       lt.pass_through_sar, lt.fee_sar, lt.unclassed_sar
from public.finance_invoices i
join public.money_row_rules() m on m.id = i.id
left join public.money_line_totals lt on lt.invoice_no = i.invoice_no
where i.deleted_at is null;

-- money_that_counts was built as "select * from money_rows" — a view's * is fixed when it is made, so it is made again to
-- carry the new columns (appended, so this is an in-place replace)
create or replace view public.money_that_counts with (security_invoker = on) as
select * from public.money_rows where counts;

-- finance_lines (every KPI reads it): a missing cost is missing, never 0 — and a commission is not "missing"
create or replace view public.finance_lines with (security_invoker = on) as
select m.id, m.invoice_no, m.invoice_date, m.client_group, m.business_id, m.revenue_sar, m.cost_sar, m.profit_sar,
       m.amount_received_sar, m.amount_remaining_sar,
       m.cost_missing, m.source_batch
from public.money_that_counts m;

-- =====================================================================
-- 5. the import commit — fills and never wipes (import rule 2); the item lines are replaced per invoice (rule 4)
-- =====================================================================
-- the old four-argument version goes first: two versions would make a call by name ambiguous. An open tab still sending four
-- named arguments reaches the new one (p_item_lines has a default).
drop function if exists public.fn_commit_finance_import(jsonb, jsonb, jsonb, jsonb);
create or replace function public.fn_commit_finance_import(p_insert jsonb default '[]'::jsonb, p_update jsonb default '[]'::jsonb,
  p_capture_lines jsonb default '[]'::jsonb, p_capture_gates jsonb default '[]'::jsonb, p_item_lines jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_inserted int := 0; v_updated int := 0; v_capture_lines int := 0; v_capture_gates int := 0; v_item_lines int := 0;
  v_touched_refs text[];
begin
  if p_insert is not null and jsonb_typeof(p_insert) = 'array' and jsonb_array_length(p_insert) > 0 then
    insert into public.finance_invoices (
      invoice_no, zatca_dpin, client_group, customer_raw_name, invoice_date, month, quarter,
      products, service_type, record_type, total_incl_vat_sar, wallet_portion_sar, revenue_sar,
      cost_sar, profit_sar, amount_received_sar, amount_remaining_sar, collection_due_date,
      integrity_status, exclusion_reason, notes, source_batch, line_no, branch, salesman,
      project_tag, discount_sar, origin, proposal_ref, items, transaction_ref, direct_uuid,
      revenue_way, payments_client_id, customer_tax_no, discount_code,
      row_kind, payments_status, payments_status_at, paid_at, tax_invoice_date, invoice_created_on, audit_required, customer_email, billed_by_ref, source)
    -- one row per (invoice, line) even if a stale tab sends a copy twice: the newer Payments status wins (the app dedupes first)
    select distinct on (invoice_no, coalesce(line_no, 1))
      invoice_no, zatca_dpin, client_group, customer_raw_name, invoice_date, month, quarter,
      products, service_type, coalesce(record_type, 'b2b'), coalesce(total_incl_vat_sar, 0),
      coalesce(wallet_portion_sar, 0), coalesce(revenue_sar, 0), cost_sar, profit_sar,
      coalesce(amount_received_sar, 0), coalesce(amount_remaining_sar, 0),
      collection_due_date, coalesce(integrity_status, 'pending'), exclusion_reason, notes,
      source_batch, coalesce(line_no, 1), branch, salesman, project_tag, discount_sar, origin,
      proposal_ref, items, transaction_ref, direct_uuid, coalesce(revenue_way, 'invoice'),
      payments_client_id, customer_tax_no, discount_code,
      coalesce(row_kind, 'sale'), payments_status, payments_status_at, paid_at, tax_invoice_date, invoice_created_on, coalesce(audit_required, false),
      customer_email, billed_by_ref, coalesce(source, 'import')
    from jsonb_to_recordset(p_insert) as x(
      invoice_no text, zatca_dpin text, client_group text, customer_raw_name text,
      invoice_date date, month text, quarter text, products text, service_type text,
      record_type text, total_incl_vat_sar numeric, wallet_portion_sar numeric,
      revenue_sar numeric, cost_sar numeric, profit_sar numeric, amount_received_sar numeric,
      amount_remaining_sar numeric, collection_due_date date, integrity_status text,
      exclusion_reason text, notes text, source_batch text, line_no int, branch text,
      salesman text, project_tag text, discount_sar numeric, origin text, proposal_ref text,
      items jsonb, transaction_ref text, direct_uuid text, revenue_way text,
      payments_client_id text, customer_tax_no text, discount_code text,
      row_kind text, payments_status text, payments_status_at timestamptz, paid_at date, tax_invoice_date date,
      invoice_created_on date, audit_required boolean, customer_email text, billed_by_ref text, source text)
    order by invoice_no, coalesce(line_no, 1), payments_status_at desc nulls last;
    get diagnostics v_inserted = row_count;
  end if;

  if p_update is not null and jsonb_typeof(p_update) = 'array' and jsonb_array_length(p_update) > 0 then
    -- fill, never wipe: a field the new file does not carry (null) keeps what is there; money and status move only when
    -- the file carries them; a MANUAL row is never touched by an import (the preview asks a person to choose — D3)
    update public.finance_invoices f set
      zatca_dpin = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.zatca_dpin, x.zatca_dpin) else coalesce(x.zatca_dpin, f.zatca_dpin) end,
      client_group = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.client_group, x.client_group) else coalesce(x.client_group, f.client_group) end,
      customer_raw_name = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.customer_raw_name, x.customer_raw_name) else coalesce(x.customer_raw_name, f.customer_raw_name) end,
      invoice_date = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.invoice_date, x.invoice_date) else coalesce(x.invoice_date, f.invoice_date) end,
      products = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.products, x.products) else coalesce(x.products, f.products) end, service_type = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.service_type, x.service_type) else coalesce(x.service_type, f.service_type) end,
      total_incl_vat_sar = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.total_incl_vat_sar, x.total_incl_vat_sar) else coalesce(x.total_incl_vat_sar, f.total_incl_vat_sar) end,
      wallet_portion_sar = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.wallet_portion_sar, x.wallet_portion_sar) else coalesce(x.wallet_portion_sar, f.wallet_portion_sar) end,
      cost_sar = coalesce(x.cost_sar, f.cost_sar),
      amount_received_sar = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.amount_received_sar, x.amount_received_sar) else coalesce(x.amount_received_sar, f.amount_received_sar) end,
      amount_remaining_sar = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.amount_remaining_sar, x.amount_remaining_sar) else coalesce(x.amount_remaining_sar, f.amount_remaining_sar) end,
      collection_due_date = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.collection_due_date, x.collection_due_date) else coalesce(x.collection_due_date, f.collection_due_date) end,
      -- status and its dates: the newest wins (import rule 3)
      integrity_status = case when x.payments_status_at is null or f.payments_status_at is null or x.payments_status_at >= f.payments_status_at
                              then coalesce(x.integrity_status, f.integrity_status) else f.integrity_status end,
      payments_status = case when x.payments_status_at is null or f.payments_status_at is null or x.payments_status_at >= f.payments_status_at
                             then coalesce(x.payments_status, f.payments_status) else f.payments_status end,
      audit_required = case when x.payments_status_at is null or f.payments_status_at is null or x.payments_status_at >= f.payments_status_at
                            then coalesce(x.audit_required, f.audit_required) else f.audit_required end,
      payments_status_at = greatest(x.payments_status_at, f.payments_status_at),
      paid_at = greatest(x.paid_at, f.paid_at),
      tax_invoice_date = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.tax_invoice_date, x.tax_invoice_date) else coalesce(x.tax_invoice_date, f.tax_invoice_date) end,
      invoice_created_on = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.invoice_created_on, x.invoice_created_on) else coalesce(x.invoice_created_on, f.invoice_created_on) end,
      exclusion_reason = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.exclusion_reason, x.exclusion_reason) else coalesce(x.exclusion_reason, f.exclusion_reason) end, notes = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.notes, x.notes) else coalesce(x.notes, f.notes) end,
      source_batch = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.source_batch, x.source_batch) else coalesce(x.source_batch, f.source_batch) end, branch = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.branch, x.branch) else coalesce(x.branch, f.branch) end,
      salesman = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.salesman, x.salesman) else coalesce(x.salesman, f.salesman) end, discount_sar = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.discount_sar, x.discount_sar) else coalesce(x.discount_sar, f.discount_sar) end,
      items = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.items, x.items) else coalesce(x.items, f.items) end, transaction_ref = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.transaction_ref, x.transaction_ref) else coalesce(x.transaction_ref, f.transaction_ref) end,
      revenue_way = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.revenue_way, x.revenue_way) else coalesce(x.revenue_way, f.revenue_way) end,
      payments_client_id = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.payments_client_id, x.payments_client_id) else coalesce(x.payments_client_id, f.payments_client_id) end,
      customer_tax_no = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.customer_tax_no, x.customer_tax_no) else coalesce(x.customer_tax_no, f.customer_tax_no) end, discount_code = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.discount_code, x.discount_code) else coalesce(x.discount_code, f.discount_code) end,
      -- a billing link is a person's decision (they ticked it): a file, which always says "sale", never turns it back
      row_kind = case when f.row_kind = 'billing_link' and x.row_kind = 'sale' then f.row_kind else coalesce(x.row_kind, f.row_kind) end,
      customer_email = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.customer_email, x.customer_email) else coalesce(x.customer_email, f.customer_email) end,
      billed_by_ref = case when (x.payments_status_at < f.payments_status_at) then coalesce(f.billed_by_ref, x.billed_by_ref) else coalesce(x.billed_by_ref, f.billed_by_ref) end,
      updated_at = now()
    from jsonb_to_recordset(p_update) as x(
      id uuid, zatca_dpin text, client_group text, customer_raw_name text, invoice_date date, products text, service_type text,
      total_incl_vat_sar numeric, wallet_portion_sar numeric, cost_sar numeric, amount_received_sar numeric,
      amount_remaining_sar numeric, collection_due_date date, integrity_status text, exclusion_reason text, notes text,
      source_batch text, branch text, salesman text, discount_sar numeric, items jsonb, transaction_ref text, revenue_way text,
      payments_client_id text, customer_tax_no text, discount_code text, row_kind text, payments_status text,
      payments_status_at timestamptz, paid_at date, tax_invoice_date date, invoice_created_on date, audit_required boolean, customer_email text,
      billed_by_ref text)
    where f.id = x.id and f.source = 'import';
    get diagnostics v_updated = row_count;
  end if;

  if p_item_lines is not null and jsonb_typeof(p_item_lines) = 'array' and jsonb_array_length(p_item_lines) > 0 then
    select array_agg(distinct invoice_no) into v_touched_refs from jsonb_to_recordset(p_item_lines) as x(invoice_no text);
    delete from public.finance_invoice_lines where invoice_no = any(v_touched_refs);
    insert into public.finance_invoice_lines (invoice_no, line_no, kind, product, name, qty, unit_price, discount_sar, taxable, item_total_sar, source_batch)
    select distinct on (invoice_no, line_no) invoice_no, line_no, kind, product, name, qty, unit_price, discount_sar, taxable, item_total_sar, source_batch
    from rows from (jsonb_to_recordset(p_item_lines) as (invoice_no text, line_no int, kind text, product text, name text, qty numeric,
      unit_price numeric, discount_sar numeric, taxable boolean, item_total_sar numeric, source_batch text))
      with ordinality as x(invoice_no, line_no, kind, product, name, qty, unit_price, discount_sar, taxable, item_total_sar, source_batch, ord)
    order by invoice_no, line_no, ord desc;   -- a line sent twice: the last copy wins, never a refused import
    get diagnostics v_item_lines = row_count;
  end if;

  if p_capture_lines is not null and jsonb_typeof(p_capture_lines) = 'array' and jsonb_array_length(p_capture_lines) > 0 then
    select array_agg(distinct transaction_ref) into v_touched_refs from jsonb_to_recordset(p_capture_lines) as x(transaction_ref text);
    delete from public.finance_expense_lines_capture where transaction_ref = any(v_touched_refs);
    insert into public.finance_expense_lines_capture (transaction_ref, amount_sar, expense_status, source_batch)
    select transaction_ref, amount_sar, expense_status, source_batch
    from jsonb_to_recordset(p_capture_lines) as x(transaction_ref text, amount_sar numeric, expense_status text, source_batch text);
    get diagnostics v_capture_lines = row_count;
  end if;

  if p_capture_gates is not null and jsonb_typeof(p_capture_gates) = 'array' and jsonb_array_length(p_capture_gates) > 0 then
    insert into public.finance_expense_gate_capture (transaction_ref, txn_expense_status, invoice_issuing_raw, source_batch, captured_at)
    select distinct on (transaction_ref) transaction_ref, txn_expense_status, invoice_issuing_raw, source_batch, now()
    from jsonb_to_recordset(p_capture_gates) as x(transaction_ref text, txn_expense_status text, invoice_issuing_raw text, source_batch text)
    on conflict (transaction_ref) do update set
      txn_expense_status = excluded.txn_expense_status, invoice_issuing_raw = excluded.invoice_issuing_raw,
      source_batch = excluded.source_batch, captured_at = now();
    get diagnostics v_capture_gates = row_count;
  end if;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'item_lines', v_item_lines,
                            'capture_lines', v_capture_lines, 'capture_gates', v_capture_gates);
end;
$function$;
revoke all on function public.fn_commit_finance_import(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.fn_commit_finance_import(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
