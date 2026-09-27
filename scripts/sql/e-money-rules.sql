-- E — the money rules (owner-approved spec of 2026-09-27, DECISIONS D16). One screen, Finance → Rules, where a person
-- types two kinds of rule, and ONE view that every total reads:
--   EXCLUSION RULES — leave out only what is typed; everything else counts. A rule is a kind + a value + a reason, and can
--     be switched off or removed. Kinds: a Direct Payments client ID; a client name or alias (only for rows that carry no
--     client ID); a VAT or CR number (catches the same legal entity under any ID or name); a discount code; one
--     transaction number.
--   COMPANY MERGES — a company holds a typed list of client IDs (client_profiles: prepaid / postpaid / tender, any number of
--     tenders) and a typed list of discount codes (company_discount_codes). Nothing is ever merged by name, and nothing
--     automatically. A client ID or a code belongs to one company only (the unique keys already say so).
--   Exclusion beats merge. Rules are live and retroactive: money_rows is computed at read time, so adding, removing or
--   switching off a rule changes every total at once, with no re-import.
-- Nothing here creates a business record (the owner's standing rule of 27 Sep): the rules table starts EMPTY, and the old
-- name lists in app_settings (financeExclusions of 21 Aug, financeGroupMap of 26 Aug) are REMOVED, not carried over — the
-- oversight enters Takamol, the test clients and every merge by hand, as the acceptance test.
-- Rollback: e-money-rules.rollback.sql.

-- =====================================================================
-- 1. the keys a rule can match on, per finance row. Filled by the importer (D) from the Payments exports; empty until then.
-- =====================================================================
alter table public.finance_invoices
  add column if not exists payments_client_id text,   -- Direct Payments corporate_client.id
  add column if not exists customer_tax_no text,      -- the customer's VAT or CR number, as the export gives it
  add column if not exists discount_code text;        -- the discount code the sale used, if any

-- one spelling for matching: NFKC, lower case, Arabic alef / yeh / teh-marbuta folded, everything that is not a letter or
-- a digit dropped (spaces, punctuation, diacritics, tatweel). js/117 mirrors it (normMR) for the on-screen preview.
create or replace function public.money_norm(t text) returns text language sql immutable parallel safe as $$
  select nullif(regexp_replace(lower(translate(normalize(coalesce(t, ''), NFKC), 'أإآىة', 'ااايه')), '[^[:alnum:]]+', '', 'g'), '')
$$;

-- =====================================================================
-- 2. EXCLUSION RULES
-- =====================================================================
create table if not exists public.money_exclusion_rules (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client_id', 'name', 'tax_no', 'discount_code', 'transaction')),
  value text not null,
  value_norm text generated always as (public.money_norm(value)) stored,
  reason text not null,
  active boolean not null default true,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  updated_by uuid, updated_by_name text, updated_at timestamptz,
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint money_rule_value_readable check (public.money_norm(value) is not null),
  constraint money_rule_reason_given check (btrim(reason) <> ''));
create unique index if not exists money_exclusion_rules_one_live on public.money_exclusion_rules (kind, value_norm) where removed_at is null;

create or replace function public.money_exclusion_rules_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare who uuid := coalesce(auth.uid(), public.qa_user_id());
        nm text := (select coalesce(nullif(u.full_name, ''), u.email) from app_users u where u.id = coalesce(auth.uid(), public.qa_user_id()));
begin   -- the name is stamped here because a manager may not read other people's login rows, and the screen shows who
  if tg_op = 'INSERT' then
    new.value := btrim(new.value); new.reason := btrim(new.reason);
    new.created_by := who; new.created_by_name := nm; new.created_at := now();
    new.updated_by := null; new.updated_by_name := null; new.updated_at := null;
    new.removed_by := null; new.removed_by_name := null; new.removed_at := null;
    return new; end if;
  if old.removed_at is not null then raise exception 'A removed rule stays removed — add it again if it is needed'; end if;
  if new.kind is distinct from old.kind or new.value is distinct from old.value
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or new.created_by_name is distinct from old.created_by_name then
    raise exception 'A rule''s type and value never change — remove it and add a new one'; end if;
  new.reason := btrim(new.reason);
  if new.removed_at is not null then new.removed_at := now(); new.removed_by := who; new.removed_by_name := nm; new.active := false; end if;
  new.updated_at := now(); new.updated_by := who; new.updated_by_name := nm;
  return new;
end $$;
drop trigger if exists money_exclusion_rules_guard on public.money_exclusion_rules;
create trigger money_exclusion_rules_guard before insert or update on public.money_exclusion_rules for each row execute function public.money_exclusion_rules_guard();
drop trigger if exists money_exclusion_rules_no_delete on public.money_exclusion_rules;
create trigger money_exclusion_rules_no_delete before delete on public.money_exclusion_rules for each row execute function public.block_hard_delete();
drop trigger if exists trg_record_history on public.money_exclusion_rules;
create trigger trg_record_history after insert or update or delete on public.money_exclusion_rules for each row execute function public.record_history_write();

alter table public.money_exclusion_rules enable row level security;
drop policy if exists money_rules_read on public.money_exclusion_rules;
create policy money_rules_read on public.money_exclusion_rules for select to authenticated using (public.can_see_page('finance'));
drop policy if exists money_rules_insert on public.money_exclusion_rules;
create policy money_rules_insert on public.money_exclusion_rules for insert to authenticated with check (public.app_role() in ('admin', 'manager'));
drop policy if exists money_rules_update on public.money_exclusion_rules;
create policy money_rules_update on public.money_exclusion_rules for update to authenticated
  using (public.app_role() in ('admin', 'manager')) with check (public.app_role() in ('admin', 'manager'));
revoke all on public.money_exclusion_rules from anon;
grant select, insert, update on public.money_exclusion_rules to authenticated;

-- =====================================================================
-- 3. COMPANY MERGES — client IDs: any number per company (the cap of 3 is lifted; still one OPEN prepaid and one OPEN
--    postpaid, by the existing unique index), and only admins and managers add, move or close them. Discount codes: the
--    same — admins and managers only.
-- =====================================================================
create or replace function public.client_profiles_card_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  new.direct_client_id := btrim(new.direct_client_id);   -- " 95" and "95" are the same Direct Payments client
  if new.direct_client_id is null or new.direct_client_id = '' then
    raise exception 'A client ID needs the number Direct Payments gave it'; end if;
  return new;
end $$;

drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles for all to authenticated
  using (public.app_role() in ('admin', 'manager')) with check (public.app_role() in ('admin', 'manager'));
drop policy if exists cdc_insert on public.company_discount_codes;
create policy cdc_insert on public.company_discount_codes for insert to authenticated with check (public.app_role() in ('admin', 'manager'));
drop policy if exists cdc_update on public.company_discount_codes;
create policy cdc_update on public.company_discount_codes for update to authenticated
  using (public.app_role() in ('admin', 'manager')) with check (public.app_role() in ('admin', 'manager'));

-- 3b. NAME ALIASES — a typed merge for rows that carry no client ID and no code (the old pre-Payments invoices carry only a
--     customer name): a person types a customer name (any spelling, Arabic or English) into a company, and every row with
--     that name and no client ID counts under it. Same shape as the rules: who is stamped, one company per name however it
--     is spelled, the name never changes (remove and add), a removal is final, nothing is deleted, every change logged.
create table if not exists public.company_name_aliases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  name text not null,
  name_norm text generated always as (public.money_norm(name)) stored,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint company_alias_readable check (public.money_norm(name) is not null));
create unique index if not exists company_name_aliases_one_company on public.company_name_aliases (name_norm) where removed_at is null;
create index if not exists company_name_aliases_business on public.company_name_aliases (business_id) where removed_at is null;
create or replace function public.company_name_aliases_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare who uuid := coalesce(auth.uid(), public.qa_user_id());
        nm text := (select coalesce(nullif(u.full_name, ''), u.email) from app_users u where u.id = coalesce(auth.uid(), public.qa_user_id()));
begin
  if tg_op = 'INSERT' then
    new.name := btrim(new.name); new.created_by := who; new.created_by_name := nm; new.created_at := now();
    new.removed_by := null; new.removed_by_name := null; new.removed_at := null; return new; end if;
  if old.removed_at is not null then raise exception 'A removed name stays removed — add it again if it is needed'; end if;
  if new.name is distinct from old.name or new.business_id is distinct from old.business_id or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at or new.created_by_name is distinct from old.created_by_name then
    raise exception 'A name is never re-pointed — remove it and add it to the right company'; end if;
  if new.removed_at is not null then new.removed_at := now(); new.removed_by := who; new.removed_by_name := nm; end if;
  return new;
end $$;
drop trigger if exists company_name_aliases_guard on public.company_name_aliases;
create trigger company_name_aliases_guard before insert or update on public.company_name_aliases for each row execute function public.company_name_aliases_guard();
drop trigger if exists company_name_aliases_no_delete on public.company_name_aliases;
create trigger company_name_aliases_no_delete before delete on public.company_name_aliases for each row execute function public.block_hard_delete();
drop trigger if exists trg_record_history on public.company_name_aliases;
create trigger trg_record_history after insert or update or delete on public.company_name_aliases for each row execute function public.record_history_write();
alter table public.company_name_aliases enable row level security;
drop policy if exists company_alias_read on public.company_name_aliases;
create policy company_alias_read on public.company_name_aliases for select to authenticated using (public.app_role() is not null);
drop policy if exists company_alias_insert on public.company_name_aliases;
create policy company_alias_insert on public.company_name_aliases for insert to authenticated with check (public.app_role() in ('admin', 'manager'));
drop policy if exists company_alias_update on public.company_name_aliases;
create policy company_alias_update on public.company_name_aliases for update to authenticated
  using (public.app_role() in ('admin', 'manager')) with check (public.app_role() in ('admin', 'manager'));
revoke all on public.company_name_aliases from anon;
grant select, insert, update on public.company_name_aliases to authenticated;

-- =====================================================================
-- 4. WHAT COUNTS — one resolver, one view. The resolver runs with the definer's rights so every person with Finance
--    sees the SAME company and the same rule for a row (the rules must not depend on which companies a viewer may
--    read); it answers nobody without Finance. The view is security_invoker, so the rows themselves stay under
--    finance_invoices' own read rule.
--    Company, in this order: the company that holds the row's client ID → (for a row with no client ID) the company that
--    holds its discount code → the company its customer name is typed into → otherwise the row stands alone ("not merged": its own client ID, or 'Unassigned codes', or its own name).
--    Rule, in this order: transaction → client ID → VAT/CR → discount code → name (name only for rows with no client ID).
-- =====================================================================
create or replace function public.money_row_rules()
returns table (id uuid, business_id uuid, company_key text, company_name text, merge_state text, profile_type text,
               rule_id uuid, rule_kind text, rule_value text, rule_reason text)
language plpgsql stable security definer set search_path to public as $$
begin
  if not public.can_see_page('finance') then return; end if;
  return query
  with r as (select * from money_exclusion_rules x where x.active and x.removed_at is null),
  base as (
    select i.id, i.invoice_no, i.transaction_ref, i.client_group, i.customer_raw_name,
           money_norm(i.payments_client_id) cid, money_norm(i.customer_tax_no) tax, money_norm(i.discount_code) code,
           cp.business_id cid_biz, cp.profile_type ptype, dc.business_id code_biz, na.business_id name_biz
    from finance_invoices i
    left join client_profiles cp on money_norm(cp.direct_client_id) = money_norm(i.payments_client_id)
    left join lateral (select c.business_id from company_discount_codes c join promo_codes p on p.id = c.promo_code_id
                       where c.removed_at is null and money_norm(p.code) = money_norm(i.discount_code) limit 1) dc on true
    left join lateral (select a.business_id from company_name_aliases a where a.removed_at is null
                       and a.name_norm in (money_norm(i.client_group), money_norm(i.customer_raw_name)) limit 1) na on true
    where i.deleted_at is null),
  res as (
    select b.*, coalesce(b.cid_biz, case when b.cid is null then coalesce(b.code_biz, b.name_biz) end) biz from base b)   -- a row with its own client ID goes by that ID alone
  select s.id, s.biz,
         case when s.biz is not null then 'biz:' || s.biz::text
              when s.cid is not null then 'cid:' || s.cid
              when s.code is not null then 'codes:unassigned'
              else 'name:' || coalesce(money_norm(coalesce(s.client_group, s.customer_raw_name)), '?') end,
         case when s.biz is not null then bz.name
              when s.cid is not null then coalesce(s.customer_raw_name, s.client_group)
              when s.code is not null then 'Unassigned codes'
              else coalesce(s.client_group, s.customer_raw_name) end,
         case when s.biz is not null then 'merged' when s.cid is not null then 'not_merged'
              when s.code is not null then 'unassigned_code' else 'no_client_id' end,
         case when s.cid_biz is not null then s.ptype end,
         x.id, x.kind, x.value, x.reason
  from res s
  left join businesses bz on bz.id = s.biz
  left join lateral (
    select r.id, r.kind, r.value, r.reason from r
    where (r.kind = 'transaction' and r.value_norm in (money_norm(s.transaction_ref), money_norm(s.invoice_no)))
       or (r.kind = 'client_id' and r.value_norm = s.cid)
       or (r.kind = 'tax_no' and (r.value_norm = s.tax
                                   or (length(r.value_norm) >= 8 and strpos(coalesce(money_norm(bz.cr_vat), ''), r.value_norm) > 0)))
       or (r.kind = 'discount_code' and r.value_norm = s.code)
       or (r.kind = 'name' and s.cid is null and r.value_norm in (money_norm(s.client_group), money_norm(s.customer_raw_name)))
    order by array_position(array['transaction', 'client_id', 'tax_no', 'discount_code', 'name'], r.kind), r.created_at
    limit 1) x on true;
end $$;
revoke all on function public.money_row_rules() from public, anon;
grant execute on function public.money_row_rules() to authenticated;

-- every live finance row, with its company, the rule that leaves it out (if any), whether it counts, and its age if unpaid
create or replace view public.money_rows with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, i.customer_raw_name, i.payments_client_id, i.discount_code,
       i.transaction_ref, i.integrity_status, i.revenue_way,
       i.revenue_sar, i.cost_sar, i.profit_sar, i.amount_received_sar, i.amount_remaining_sar, i.collection_due_date,
       i.source_batch,
       m.business_id, m.company_key, m.company_name, m.merge_state, m.profile_type,
       m.rule_id, m.rule_kind, m.rule_value, m.rule_reason,
       (m.rule_id is not null or i.exclusion_reason is not null) as excluded,
       (m.rule_id is null and i.exclusion_reason is null and i.integrity_status = 'verified_paid') as counts,
       case when m.rule_id is null and i.exclusion_reason is null and coalesce(i.amount_remaining_sar, 0) > 0
            then greatest(0, current_date - coalesce(i.collection_due_date, i.invoice_date)) end as open_age_days
from public.finance_invoices i
join public.money_row_rules() m on m.id = i.id
where i.deleted_at is null;
grant select on public.money_rows to authenticated;

-- the rows that count: paid, not deleted, not caught by a rule. finance_lines — and through it every KPI, finance_as_of,
-- finance_credit and project_money — now reads it, so Finance, Reports and KPIs cannot disagree.
create or replace view public.money_that_counts with (security_invoker = on) as
select * from public.money_rows where counts;
grant select on public.money_that_counts to authenticated;

create or replace view public.finance_lines with (security_invoker = on) as
select m.id, m.invoice_no, m.invoice_date, m.client_group, m.business_id, m.revenue_sar, m.cost_sar, m.profit_sar,
       m.amount_received_sar, m.amount_remaining_sar,
       ((m.cost_sar is null) or (m.cost_sar = 0::numeric)) as cost_missing, m.source_batch
from public.money_that_counts m;

-- =====================================================================
-- 5. the old name lists leave the settings store (owner, 27 Sep): nothing re-created from them. Backed up outside the
--    database before this runs (the apply step), like every wipe.
-- =====================================================================
update public.app_settings set data = data - 'financeExclusions' - 'financeGroupMap'
where data ? 'financeExclusions' or data ? 'financeGroupMap';
