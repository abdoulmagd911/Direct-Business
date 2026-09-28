-- Cost import — the raw Direct Payments cost exports (second builder, 28 Sep 2026; DECISIONS D27). Rollback:
-- cost-import.rollback.sql. No existing data changes: two new tables, one import function, one insert trigger.
--
-- The files (Drive 04 §4–5), read by js/121-cost-import.js in the browser and sent here in chunks:
--   · Transaction Expense Export — one row per expense line: Invoice# (the Payments reference = the money row's
--     invoice_no), Amount (SAR) (blank while Pending), Expense Type, Status, Created At, Submission Date,
--     Approval/Rejection Date, Merchant, ID Reference, Submitter, Approver/Rejector. The customer and card columns are
--     never sent or stored.
--   · Expense Invoice Export — one row per reference: its expense status summary and the Overdue flag (collections).
--   · Revenue Report — only its Total Expense Amount (the submitted expenses) is kept, as the cost FALLBACK
--     (cost-fallback.sql); its Total Revenue / Revenue / VAT columns are never read (M1, and they overstate profit).
--
-- The rules (Drive 04 §5, the owner's of 28 Sep):
--   · cost = the sum of APPROVED lines only; Pending, Under Review, Cancelled and Rejected never count; no approved line
--     = no cost (empty, never 0 — D21), and an approved expense replaces the D23 estimate simply by arriving;
--   · a reference with no money row is HELD — never stored, never turned into an invoice row; the screen lists it;
--   · any file, any order, any time, overlapping or partial periods: a line is known by (reference, expense type,
--     created at); a NEWER file (by its Payments export time) wins for that line, an OLDER one only fills what is
--     empty; a blank cell never wipes; the same file twice changes nothing;
--   · lines are replaced per reference inside the period a file covers: a stored line of a reference the file carries,
--     created inside the file's first-to-last Created At, that the (newer) file no longer lists, is dropped — a partial
--     file never touches lines outside its own dates;
--   · a hand-entered money row is never touched (D3); a commission carries no cost by nature; a reference with several
--     money rows is left for a person.

-- =====================================================================
-- 1. the expense lines (only lines whose reference has a money row)
-- =====================================================================
create table if not exists public.finance_expense_lines (
  id uuid primary key default gen_random_uuid(),
  ref text not null,                      -- the Payments reference (Invoice#) = finance_invoices.invoice_no
  line_key text not null unique,          -- ref | expense type | created at [| #n] — the line across files
  expense_type text,
  status text not null,                   -- approved | pending | under_review | cancelled | rejected | other
  status_raw text,
  amount_sar numeric,                     -- blank while Pending
  id_reference text, merchant text,
  created_on timestamptz, submitted_on timestamptz, decided_on timestamptz,
  submitter text, approver text,
  seen_at timestamptz,                    -- the Payments export time of the file that last set this line
  source_batch text,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_expense_lines_ref on public.finance_expense_lines (ref);

-- =====================================================================
-- 2. what the other two files say per reference, and the cost last written from lines
-- =====================================================================
create table if not exists public.finance_payments_facts (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  -- the Expense Invoice Export
  request_number text, invoice_product text, invoice_amount_sar numeric, invoice_status text, invoice_type text,
  expense_assignments text,               -- e.g. "6 Approved , 1 Cancelled" (display only)
  overdue text,                           -- e.g. "1 Overdue"; blank = none (collections)
  created_by text, created_on timestamptz, ei_seen_at timestamptz,
  -- the Revenue Report: the submitted expenses, the cost fallback (never revenue, never VAT)
  rr_total_expense_sar numeric, rr_seen_at timestamptz,
  -- the cost this import last wrote into finance_invoices from approved lines, so a later file in which those lines
  -- are all cancelled takes back exactly that — and never a cost someone else wrote
  lines_cost_sar numeric,
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3. who may read and write: Finance, by page level (like every finance table); every change in the change log
-- =====================================================================
alter table public.finance_expense_lines enable row level security;
alter table public.finance_payments_facts enable row level security;
drop policy if exists fin_expense_lines_read on public.finance_expense_lines;
drop policy if exists fin_expense_lines_write on public.finance_expense_lines;
drop policy if exists fin_payments_facts_read on public.finance_payments_facts;
drop policy if exists fin_payments_facts_write on public.finance_payments_facts;
create policy fin_expense_lines_read on public.finance_expense_lines for select using (public.can_see_page('finance'));
create policy fin_expense_lines_write on public.finance_expense_lines for all
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
create policy fin_payments_facts_read on public.finance_payments_facts for select using (public.can_see_page('finance'));
create policy fin_payments_facts_write on public.finance_payments_facts for all
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
revoke all on public.finance_expense_lines, public.finance_payments_facts from anon;
drop trigger if exists trg_record_history on public.finance_expense_lines;
create trigger trg_record_history after insert or update or delete on public.finance_expense_lines
  for each row execute function public.record_history_write();
drop trigger if exists trg_record_history on public.finance_payments_facts;
create trigger trg_record_history after insert or update or delete on public.finance_payments_facts
  for each row execute function public.record_history_write();

-- =====================================================================
-- 4. the cost of one money row from its stored lines (null = no approved line, the cost stays empty)
-- =====================================================================
create or replace function public.finance_cost_from_lines(p_ref text) returns numeric
language sql stable set search_path to 'public', 'pg_temp' as $$
  select case when count(*) filter (where status = 'approved') > 0
              then round(coalesce(sum(amount_sar) filter (where status = 'approved'), 0), 2) end
  from public.finance_expense_lines where ref = p_ref;
$$;

-- =====================================================================
-- 5. the import — lines, facts, then the cost of every reference it touched
-- =====================================================================
create or replace function public.fn_cost_import(
  p_lines jsonb default '[]'::jsonb,       -- Transaction Expense Export lines (already read and named by js/121)
  p_facts jsonb default '[]'::jsonb,       -- Expense Invoice Export / Revenue Report rows, one per reference
  p_seen_at timestamptz default null,      -- the file's Payments export time (newer file wins)
  p_window_from timestamptz default null,  -- the file's first and last Created At (lines are replaced inside it)
  p_window_to timestamptz default null,
  p_batch text default null)
returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_seen timestamptz := coalesce(p_seen_at, now());
  v_refs text[]; v_ref text; v_n int; f record; v_new numeric; v_prev numeric;
  n_new int := 0; n_changed int := 0; n_dropped int := 0; n_held int := 0; n_f_new int := 0; n_f_changed int := 0;
  n_cost_set int := 0; n_cost_changed int := 0; n_cost_cleared int := 0; n_cost_same int := 0; n_waiting int := 0;
  n_manual int := 0; n_commission int := 0; n_several int := 0;
begin
  if not public.can_edit_page('finance') then
    raise exception 'cost import: this needs Full control of Finance' using errcode = '42501';
  end if;

  -- ---- the lines: only references that have a money row; the rest are held (the screen lists them) ----
  drop table if exists _ci_lines; drop table if exists _ci_facts;   -- two calls in one transaction must not collide
  create temp table _ci_lines on commit drop as
  select distinct on (x.line_key) x.*
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as x(ref text, line_key text, expense_type text, status text,
    status_raw text, amount_sar numeric, id_reference text, merchant text, created_on timestamptz, submitted_on timestamptz,
    decided_on timestamptz, submitter text, approver text)
  where x.ref is not null and x.line_key is not null and x.status is not null;
  select count(distinct l.ref) into n_held from _ci_lines l
   where not exists (select 1 from public.finance_invoices i where i.invoice_no = l.ref and i.deleted_at is null);
  delete from _ci_lines l
   where not exists (select 1 from public.finance_invoices i where i.invoice_no = l.ref and i.deleted_at is null);
  update _ci_lines set status = 'other' where status not in ('approved', 'pending', 'under_review', 'cancelled', 'rejected');

  -- an existing line: a newer (or same-age) file sets it — a blank cell never wipes; an older file only fills blanks.
  -- Only a real difference is written (a file that says nothing new writes nothing, so the change log stays honest).
  with upd as (
    update public.finance_expense_lines t set
      status      = case when v_seen >= coalesce(t.seen_at, '-infinity') then x.status else t.status end,
      status_raw  = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.status_raw, t.status_raw) else t.status_raw end,
      amount_sar  = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.amount_sar, t.amount_sar) else coalesce(t.amount_sar, x.amount_sar) end,
      expense_type = coalesce(t.expense_type, x.expense_type),
      id_reference = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.id_reference, t.id_reference) else coalesce(t.id_reference, x.id_reference) end,
      merchant    = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.merchant, t.merchant) else coalesce(t.merchant, x.merchant) end,
      submitted_on = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.submitted_on, t.submitted_on) else coalesce(t.submitted_on, x.submitted_on) end,
      decided_on  = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.decided_on, t.decided_on) else coalesce(t.decided_on, x.decided_on) end,
      submitter   = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.submitter, t.submitter) else coalesce(t.submitter, x.submitter) end,
      approver    = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(x.approver, t.approver) else coalesce(t.approver, x.approver) end,
      seen_at     = greatest(t.seen_at, v_seen),
      source_batch = case when v_seen >= coalesce(t.seen_at, '-infinity') then coalesce(p_batch, t.source_batch) else t.source_batch end,
      updated_at  = now()
    from _ci_lines x
    where t.line_key = x.line_key
      and (   (v_seen >= coalesce(t.seen_at, '-infinity') and (t.status is distinct from x.status
                 or (x.amount_sar is not null and t.amount_sar is distinct from x.amount_sar)
                 or (x.id_reference is not null and t.id_reference is distinct from x.id_reference)
                 or (x.merchant is not null and t.merchant is distinct from x.merchant)
                 or (x.submitted_on is not null and t.submitted_on is distinct from x.submitted_on)
                 or (x.decided_on is not null and t.decided_on is distinct from x.decided_on)
                 or (x.submitter is not null and t.submitter is distinct from x.submitter)
                 or (x.approver is not null and t.approver is distinct from x.approver)))
           or (v_seen < coalesce(t.seen_at, '-infinity') and ((t.amount_sar is null and x.amount_sar is not null)
                 or (t.id_reference is null and x.id_reference is not null) or (t.merchant is null and x.merchant is not null)
                 or (t.submitted_on is null and x.submitted_on is not null) or (t.decided_on is null and x.decided_on is not null)
                 or (t.submitter is null and x.submitter is not null) or (t.approver is null and x.approver is not null))))
    returning 1)
  select count(*) into n_changed from upd;

  -- then the lines no file sent before
  with ins as (
    insert into public.finance_expense_lines (ref, line_key, expense_type, status, status_raw, amount_sar, id_reference,
      merchant, created_on, submitted_on, decided_on, submitter, approver, seen_at, source_batch)
    select ref, line_key, expense_type, status, status_raw, amount_sar, id_reference, merchant, created_on, submitted_on,
      decided_on, submitter, approver, v_seen, p_batch
    from _ci_lines
    on conflict (line_key) do nothing
    returning 1)
  select count(*) into n_new from ins;

  -- replaced per reference inside the file's own dates: a line the newer file no longer lists is gone from Payments
  if p_window_from is not null and p_window_to is not null then
    with gone as (
      delete from public.finance_expense_lines t
       where t.ref in (select distinct ref from _ci_lines)
         and t.created_on between p_window_from and p_window_to
         and coalesce(t.seen_at, '-infinity') < v_seen
         and not exists (select 1 from _ci_lines x where x.line_key = t.line_key)
      returning 1)
    select count(*) into n_dropped from gone;
  end if;

  -- ---- the facts (Expense Invoice Export / Revenue Report): references with a money row only ----
  create temp table _ci_facts on commit drop as
  select distinct on (x.ref, x.kind) x.*
  from jsonb_to_recordset(coalesce(p_facts, '[]'::jsonb)) as x(ref text, kind text, request_number text, invoice_product text,
    invoice_amount_sar numeric, invoice_status text, invoice_type text, expense_assignments text, overdue text,
    created_by text, created_on timestamptz, rr_total_expense_sar numeric)
  where x.ref is not null and x.kind in ('ei', 'rr')
    and exists (select 1 from public.finance_invoices i where i.invoice_no = x.ref and i.deleted_at is null);
  select n_held + count(distinct x.ref) into n_held
  from jsonb_to_recordset(coalesce(p_facts, '[]'::jsonb)) as x(ref text)
  where x.ref is not null and not exists (select 1 from public.finance_invoices i where i.invoice_no = x.ref and i.deleted_at is null);

  with ins as (
    insert into public.finance_payments_facts (ref) select distinct ref from _ci_facts on conflict (ref) do nothing returning 1)
  select count(*) into n_f_new from ins;

  with ei as (
    update public.finance_payments_facts t set
      -- a status (the assignments summary, overdue, the invoice status) is the newer file's, blank included for overdue
      expense_assignments = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.expense_assignments, t.expense_assignments) else coalesce(t.expense_assignments, x.expense_assignments) end,
      overdue        = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then x.overdue else coalesce(t.overdue, x.overdue) end,
      invoice_status = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_status, t.invoice_status) else coalesce(t.invoice_status, x.invoice_status) end,
      request_number = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.request_number, t.request_number) else coalesce(t.request_number, x.request_number) end,
      invoice_product = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_product, t.invoice_product) else coalesce(t.invoice_product, x.invoice_product) end,
      invoice_amount_sar = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_amount_sar, t.invoice_amount_sar) else coalesce(t.invoice_amount_sar, x.invoice_amount_sar) end,
      invoice_type   = case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_type, t.invoice_type) else coalesce(t.invoice_type, x.invoice_type) end,
      created_by     = coalesce(t.created_by, x.created_by),
      created_on     = coalesce(t.created_on, x.created_on),
      ei_seen_at     = greatest(t.ei_seen_at, v_seen),
      updated_at     = now()
    from _ci_facts x
    where x.kind = 'ei' and t.ref = x.ref
      and (row(t.expense_assignments, t.overdue, t.invoice_status, t.request_number, t.invoice_product, t.invoice_amount_sar,
               t.invoice_type, t.created_by, t.created_on)
           is distinct from
           row(case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.expense_assignments, t.expense_assignments) else coalesce(t.expense_assignments, x.expense_assignments) end,
               case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then x.overdue else coalesce(t.overdue, x.overdue) end,
               case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_status, t.invoice_status) else coalesce(t.invoice_status, x.invoice_status) end,
               case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.request_number, t.request_number) else coalesce(t.request_number, x.request_number) end,
               case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_product, t.invoice_product) else coalesce(t.invoice_product, x.invoice_product) end,
               case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_amount_sar, t.invoice_amount_sar) else coalesce(t.invoice_amount_sar, x.invoice_amount_sar) end,
               case when v_seen >= coalesce(t.ei_seen_at, '-infinity') then coalesce(x.invoice_type, t.invoice_type) else coalesce(t.invoice_type, x.invoice_type) end,
               coalesce(t.created_by, x.created_by), coalesce(t.created_on, x.created_on)))
    returning 1),
  rr as (
    update public.finance_payments_facts t set
      rr_total_expense_sar = case when v_seen >= coalesce(t.rr_seen_at, '-infinity') then coalesce(x.rr_total_expense_sar, t.rr_total_expense_sar) else coalesce(t.rr_total_expense_sar, x.rr_total_expense_sar) end,
      rr_seen_at = greatest(t.rr_seen_at, v_seen),
      updated_at = now()
    from _ci_facts x
    where x.kind = 'rr' and t.ref = x.ref
      and t.rr_total_expense_sar is distinct from (case when v_seen >= coalesce(t.rr_seen_at, '-infinity') then coalesce(x.rr_total_expense_sar, t.rr_total_expense_sar) else coalesce(t.rr_total_expense_sar, x.rr_total_expense_sar) end)
    returning 1)
  select (select count(*) from ei) + (select count(*) from rr) into n_f_changed;

  -- ---- the cost of every reference whose lines this call carried ----
  select array_agg(distinct ref) into v_refs from _ci_lines;
  foreach v_ref in array coalesce(v_refs, '{}'::text[]) loop
    select count(*) into v_n from public.finance_invoices where invoice_no = v_ref and deleted_at is null;
    if v_n > 1 then n_several := n_several + 1; continue; end if;
    select id, source, revenue_way, cost_sar into f from public.finance_invoices where invoice_no = v_ref and deleted_at is null;
    if not found then continue; end if;
    if f.source is distinct from 'import' then n_manual := n_manual + 1; continue; end if;
    if f.revenue_way = 'commission' then n_commission := n_commission + 1; continue; end if;
    v_new := public.finance_cost_from_lines(v_ref);
    select lines_cost_sar into v_prev from public.finance_payments_facts where ref = v_ref;
    if v_new is not null then
      if f.cost_sar is null then n_cost_set := n_cost_set + 1;
      elsif f.cost_sar is distinct from v_new then n_cost_changed := n_cost_changed + 1;
      else n_cost_same := n_cost_same + 1; end if;
      if f.cost_sar is distinct from v_new then update public.finance_invoices set cost_sar = v_new where id = f.id; end if;
      insert into public.finance_payments_facts (ref, lines_cost_sar) values (v_ref, v_new)
        on conflict (ref) do update set lines_cost_sar = excluded.lines_cost_sar, updated_at = now()
        where finance_payments_facts.lines_cost_sar is distinct from excluded.lines_cost_sar;
    elsif v_prev is not null and f.cost_sar = v_prev then
      -- every approved line of this reference is gone (cancelled / rejected): take back the cost this import wrote
      update public.finance_invoices set cost_sar = null where id = f.id;
      update public.finance_payments_facts set lines_cost_sar = null, updated_at = now() where ref = v_ref;
      n_cost_cleared := n_cost_cleared + 1;
    else
      n_waiting := n_waiting + 1;
    end if;
  end loop;

  return jsonb_build_object('lines_new', n_new, 'lines_changed', n_changed, 'lines_dropped', n_dropped, 'refs_held', n_held,
    'facts_new', n_f_new, 'facts_written', n_f_changed, 'cost_set', n_cost_set, 'cost_changed', n_cost_changed,
    'cost_cleared', n_cost_cleared, 'cost_same', n_cost_same, 'waiting', n_waiting, 'manual', n_manual,
    'commission', n_commission, 'several_rows', n_several);
end;
$function$;
revoke all on function public.fn_cost_import(jsonb, jsonb, timestamptz, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.fn_cost_import(jsonb, jsonb, timestamptz, timestamptz, timestamptz, text) to authenticated;

-- =====================================================================
-- 6. any order: a money row that arrives AFTER its lines (re-imported after a delete) takes its cost from them
-- =====================================================================
create or replace function public.finance_cost_on_insert() returns trigger
language plpgsql set search_path to 'public', 'pg_temp' as $$
declare v numeric;
begin
  if new.cost_sar is null and coalesce(new.source, 'import') = 'import' and new.revenue_way is distinct from 'commission'
     and new.deleted_at is null then
    v := public.finance_cost_from_lines(new.invoice_no);
    if v is not null then
      new.cost_sar := v;
      insert into public.finance_payments_facts (ref, lines_cost_sar) values (new.invoice_no, v)
        on conflict (ref) do update set lines_cost_sar = excluded.lines_cost_sar, updated_at = now();
    end if;
  end if;
  return new;
end $$;
-- named to fire BEFORE trg_fin_inv_derive (same event, alphabetical), so profit is worked out from this cost
drop trigger if exists trg_fin_inv_a_cost_from_lines on public.finance_invoices;
create trigger trg_fin_inv_a_cost_from_lines before insert on public.finance_invoices
  for each row execute function public.finance_cost_on_insert();
