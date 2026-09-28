-- Company identifiers and automatic matching (second builder, 28 Sep 2026; DECISIONS D27, docs/reference/d27-company-identifiers.md).
-- Rollback: company-identifiers.rollback.sql. Needs e-money-rules.sql, cost-fallback.sql and clients-promo-import.sql first.
--
-- The owner's rulings of 28 Sep: each company holds typed identifiers — Payments client ID, discount code (optional dates),
-- names in English or Arabic, contact emails, phones, VAT and CR numbers — each belonging to ONE company only. Every money row
-- is matched LIVE (a view, never a stamp) in the order client ID → VAT/CR → discount code (inside its dates) → email → phone →
-- name; the first level that finds anything decides: one company = matched, two or more = Needs a decision naming them all,
-- none = Needs a decision. Adding or removing an identifier re-links past rows at once everywhere money_rows is read.
-- The old stores — billing-profile client IDs (client_profiles), linked discount codes (company_discount_codes) and
-- customer-name aliases (company_name_aliases) — are copied in once and, while anything still writes to them, feed the
-- identifiers by trigger; matching reads identifiers only (one mechanism).
do $$ begin
  if to_regprocedure('public.money_norm(text)') is null then raise exception 'company-identifiers.sql needs e-money-rules.sql first'; end if;
  if to_regclass('public.payments_clients') is null then raise exception 'company-identifiers.sql needs clients-promo-import.sql first'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'money_rows'
                 and column_name = 'est_cost_source') then raise exception 'company-identifiers.sql needs cost-fallback.sql first'; end if;
end $$;

-- the phone the invoice export carries (the matcher's fifth level; the invoice import fills it)
alter table public.finance_invoices add column if not exists customer_phone text;

-- =====================================================================
-- 1. how values are compared
-- =====================================================================
create or replace function public.ident_digits(t text) returns text language sql immutable parallel safe as $$
  select nullif(regexp_replace(translate(coalesce(t, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g'), '')
$$;
-- 0501234567 = +966 50 123 4567 = 00966501234567 → 501234567; fewer than 7 digits is no phone
create or replace function public.ident_phone(t text) returns text language sql immutable parallel safe as $$
  select case when length(x) >= 7 then x end
  from (select ltrim(regexp_replace(regexp_replace(coalesce(public.ident_digits(t), ''), '^00', ''), '^966', ''), '0') as x) s
$$;
-- a company name, however it is spelled: lower case, Arabic letter forms unified, diacritics and tatweel gone, Arabic-Indic
-- digits as 0–9, punctuation dropped, the company-form words dropped, what is left joined without spaces
create or replace function public.ident_name(t text) returns text language sql immutable parallel safe as $$
  select nullif(array_to_string(array(
    select w from unnest(regexp_split_to_array(btrim(regexp_replace(
      regexp_replace(translate(lower(normalize(coalesce(t, ''), NFKC)),
                               'أإآٱىئةؤ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'ااااييهو01234567890123456789'),
                     '[ً-ٰٟـ]', '', 'g'),
      '[^0-9a-zء-غف-يٮ-ۓۺ-ۿ]+', ' ', 'g')), '\s+')) with ordinality u(w, o)
    where w <> '' and w not in ('شركه', 'موسسه', 'company', 'co', 'corp', 'corporation', 'ltd', 'limited', 'llc', 'inc', 'est')
    order by o), ''), '')
$$;
create or replace function public.ident_norm(p_kind text, p_value text) returns text language sql immutable parallel safe as $$
  select case p_kind
    when 'name' then public.ident_name(p_value)
    when 'email' then nullif(lower(btrim(coalesce(p_value, ''))), '')
    when 'phone' then public.ident_phone(p_value)
    when 'vat' then public.ident_digits(p_value)
    when 'cr' then public.ident_digits(p_value)
    else public.money_norm(p_value) end
$$;

-- =====================================================================
-- 2. the identifiers
-- =====================================================================
create table if not exists public.company_identifiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  kind text not null check (kind in ('client_id', 'discount_code', 'name', 'email', 'phone', 'vat', 'cr')),
  value text not null,
  value_norm text generated always as (public.ident_norm(kind, value)) stored,
  valid_from date, valid_to date,                     -- discount codes only: the days the code counts for this company
  source text not null default 'person' check (source in ('person', 'decision', 'import', 'moved', 'billing_profile', 'merge')),
  note text,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint company_identifier_readable check (public.ident_norm(kind, value) is not null),
  constraint company_identifier_dates_only_codes check ((valid_from is null and valid_to is null) or kind = 'discount_code'),
  constraint company_identifier_date_order check (valid_from is null or valid_to is null or valid_to >= valid_from),
  constraint company_identifier_email_shape check (kind <> 'email' or value ~ '@'),
  constraint company_identifier_not_staff check (kind <> 'email' or lower(value) !~ '@([a-z0-9-]+\.)*directksa\.'),
  constraint company_identifier_not_dummy_vat check (kind not in ('vat', 'cr') or public.ident_digits(value) <> '311111111111113'));
-- one identifier belongs to ONE company only
create unique index if not exists company_identifiers_one_company on public.company_identifiers (kind, value_norm) where removed_at is null;
create index if not exists company_identifiers_business on public.company_identifiers (business_id) where removed_at is null;

-- who is stamped; a value under an exclusion rule (test clients …) is never an identifier; the company, type and value never
-- change (remove it and add it to the right company); a removed identifier can be put back (the undo) unless another
-- company holds it by then; nothing is deleted
create or replace function public.company_identifiers_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare who uuid := coalesce(auth.uid(), public.qa_user_id());
        nm text := (select coalesce(nullif(u.full_name, ''), u.email) from app_users u where u.id = coalesce(auth.uid(), public.qa_user_id()));
        rk text;
begin
  if tg_op = 'INSERT' then
    new.value := btrim(new.value);
    rk := case new.kind when 'client_id' then 'client_id' when 'discount_code' then 'discount_code' when 'name' then 'name'
                        when 'vat' then 'tax_no' when 'cr' then 'tax_no' end;
    if rk is not null and exists (select 1 from money_exclusion_rules x where x.active and x.removed_at is null and x.kind = rk
          and (x.value_norm = public.money_norm(new.value) or (rk = 'tax_no' and public.ident_digits(x.value) = public.ident_digits(new.value)))) then
      raise exception 'This % is under an exclusion rule on Finance → Rules (a test client or a left-out company) — it is never an identifier', new.kind
        using errcode = '23514';
    end if;
    new.created_by := who; new.created_by_name := nm; new.created_at := now();
    new.removed_by := null; new.removed_by_name := null; new.removed_at := null;
    return new;
  end if;
  if new.business_id is distinct from old.business_id or new.kind is distinct from old.kind or new.value is distinct from old.value
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at or new.source is distinct from old.source then
    raise exception 'An identifier is never moved or rewritten — remove it and add it to the right company' using errcode = '23514';
  end if;
  if old.removed_at is null and new.removed_at is not null then
    new.removed_at := now(); new.removed_by := who; new.removed_by_name := nm;
  elsif old.removed_at is not null and new.removed_at is null then          -- put back (the undo of a removal)
    new.removed_by := null; new.removed_by_name := null;
  elsif old.removed_at is not null then
    raise exception 'A removed identifier changes only by being put back' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists company_identifiers_guard on public.company_identifiers;
create trigger company_identifiers_guard before insert or update on public.company_identifiers
  for each row execute function public.company_identifiers_guard();
drop trigger if exists company_identifiers_no_delete on public.company_identifiers;
create trigger company_identifiers_no_delete before delete on public.company_identifiers
  for each row execute function public.block_hard_delete();
drop trigger if exists trg_record_history on public.company_identifiers;
create trigger trg_record_history after insert or update or delete on public.company_identifiers
  for each row execute function public.record_history_write();
alter table public.company_identifiers enable row level security;
drop policy if exists company_identifiers_read on public.company_identifiers;
create policy company_identifiers_read on public.company_identifiers for select to authenticated using (public.app_role() is not null);
drop policy if exists company_identifiers_insert on public.company_identifiers;
create policy company_identifiers_insert on public.company_identifiers for insert to authenticated
  with check (public.app_role() in ('admin', 'manager') and (public.can_edit_page('finance') or public.can_edit_page('clients')));
drop policy if exists company_identifiers_update on public.company_identifiers;
create policy company_identifiers_update on public.company_identifiers for update to authenticated
  using (public.app_role() in ('admin', 'manager') and (public.can_edit_page('finance') or public.can_edit_page('clients')))
  with check (public.app_role() in ('admin', 'manager') and (public.can_edit_page('finance') or public.can_edit_page('clients')));
revoke all on public.company_identifiers from anon;
revoke delete on public.company_identifiers from authenticated;
grant select, insert, update on public.company_identifiers to authenticated;

-- =====================================================================
-- 3. the matcher — every money row, live. Runs with the definer's rights (like money_row_rules) so every Finance viewer
--    sees the same company for a row; answers nobody without Finance.
-- =====================================================================
create or replace function public.money_company_match()
returns table (id uuid, business_id uuid, match_level text, match_state text, candidates uuid[], row_client_id text)
language plpgsql stable security definer set search_path to public as $$
begin
  if not public.can_see_page('finance') then return; end if;
  return query
  with pc as (   -- the Payments client an email names (the register, D26): exactly one client, never a staff address
    select lower(btrim(p.contact_email)) as em, min(p.client_id) as client_id from payments_clients p
    where p.contact_email is not null and p.contact_email !~* '@([a-z0-9-]+\.)*directksa\.'
    group by 1 having count(*) = 1),
  r as (
    select i.id as rid, i.invoice_date,
           coalesce(nullif(btrim(i.payments_client_id), ''), pc.client_id) as cid_raw,
           public.money_norm(coalesce(nullif(btrim(i.payments_client_id), ''), pc.client_id)) as cid,
           public.ident_digits(i.customer_tax_no) as tax, public.money_norm(i.discount_code) as code,
           nullif(lower(btrim(i.customer_email)), '') as email, public.ident_phone(i.customer_phone) as phone,
           public.ident_name(i.client_group) as n1, public.ident_name(i.customer_raw_name) as n2
    from finance_invoices i left join pc on pc.em = lower(btrim(i.customer_email))
    where i.deleted_at is null),
  ci as (select c.business_id, c.kind, c.value_norm, c.valid_from, c.valid_to from company_identifiers c where c.removed_at is null),
  cand as (
    select r.rid, 1 as lvl, ci.business_id as biz from r join ci on ci.kind = 'client_id' and ci.value_norm = r.cid
    union select r.rid, 2, ci.business_id from r join ci on ci.kind in ('vat', 'cr') and ci.value_norm = r.tax
    union select r.rid, 3, ci.business_id from r join ci on ci.kind = 'discount_code' and ci.value_norm = r.code
            and (ci.valid_from is null or r.invoice_date >= ci.valid_from) and (ci.valid_to is null or r.invoice_date <= ci.valid_to)
    union select r.rid, 4, ci.business_id from r join ci on ci.kind = 'email' and ci.value_norm = r.email
    union select r.rid, 5, ci.business_id from r join ci on ci.kind = 'phone' and ci.value_norm = r.phone
    union select r.rid, 6, ci.business_id from r join ci on ci.kind = 'name' and ci.value_norm in (r.n1, r.n2)),
  win as (
    select c.rid, c.lvl, array_agg(c.biz order by c.biz) as bs
    from cand c where c.lvl = (select min(c2.lvl) from cand c2 where c2.rid = c.rid)
    group by c.rid, c.lvl)
  select r.rid, case when cardinality(w.bs) = 1 then w.bs[1] end,
         case w.lvl when 1 then 'client_id' when 2 then 'vat_cr' when 3 then 'discount_code' when 4 then 'email'
                    when 5 then 'phone' when 6 then 'name' end,
         case when w.rid is null then 'none' when cardinality(w.bs) = 1 then 'matched' else 'conflict' end,
         w.bs, r.cid_raw
  from r left join win w on w.rid = r.rid;
end $$;
revoke all on function public.money_company_match() from public, anon;
grant execute on function public.money_company_match() to authenticated;

-- =====================================================================
-- 4. the money rules read the matcher (same columns, so nothing downstream is rebuilt). Exclusions are unchanged and
--    still win (D16); a row's client ID for the client-ID rules is its own, else the Payments client its email names.
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
           money_norm(m.row_client_id) cid, money_norm(i.customer_tax_no) tax, money_norm(i.discount_code) code,
           m.business_id biz, m.match_state, m.match_level
    from finance_invoices i join public.money_company_match() m on m.id = i.id
    where i.deleted_at is null)
  select s.id, s.biz,
         case when s.biz is not null then 'biz:' || s.biz::text
              when s.match_state = 'conflict' then 'conflict:' || coalesce(s.cid, money_norm(coalesce(s.client_group, s.customer_raw_name)), s.id::text)
              when s.cid is not null then 'cid:' || s.cid
              when s.code is not null then 'codes:unassigned'
              else 'name:' || coalesce(money_norm(coalesce(s.client_group, s.customer_raw_name)), '?') end,
         case when s.biz is not null then bz.name
              when s.cid is not null then coalesce(s.customer_raw_name, s.client_group)
              when s.code is not null then 'Unassigned codes'
              else coalesce(s.client_group, s.customer_raw_name) end,
         case when s.biz is not null then 'merged' when s.cid is not null then 'not_merged'
              when s.code is not null then 'unassigned_code' else 'no_client_id' end,
         (select cp.profile_type from client_profiles cp
           where s.match_level = 'client_id' and cp.business_id = s.biz and money_norm(cp.direct_client_id) = s.cid
           order by cp.closed_at nulls first limit 1),
         x.id, x.kind, x.value, x.reason
  from base s
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

-- money_rows gains how each row was matched (columns appended; the rest is cost-fallback.sql's definition, unchanged)
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
       lt.pass_through_sar, lt.fee_sar, lt.unclassed_sar,
       case when i.cost_sar is null and i.revenue_way is distinct from 'commission'
            then coalesce(case when pf.rr_total_expense_sar > 0 then pf.rr_total_expense_sar end,
                          case when coalesce(lt.pass_through_sar, 0) > 0 then lt.pass_through_sar end) end as est_cost_sar,
       (i.cost_sar is null and i.revenue_way is distinct from 'commission'
        and (coalesce(pf.rr_total_expense_sar, 0) > 0 or coalesce(lt.pass_through_sar, 0) > 0)) as cost_estimated,
       case when i.cost_sar is null and i.revenue_way is distinct from 'commission' then
            case when coalesce(pf.rr_total_expense_sar, 0) > 0 then 'submitted_expenses'
                 when coalesce(lt.pass_through_sar, 0) > 0 then 'pass_through' end end as est_cost_source,
       mc.match_level, mc.match_state, mc.candidates as match_candidates, i.customer_email, i.customer_tax_no, i.customer_phone,
       mc.row_client_id
from public.finance_invoices i
join public.money_row_rules() m on m.id = i.id
join public.money_company_match() mc on mc.id = i.id
left join public.money_line_totals lt on lt.invoice_no = i.invoice_no
left join public.finance_payments_facts pf on pf.ref = i.invoice_no
where i.deleted_at is null;

create or replace view public.money_that_counts with (security_invoker = on) as
select * from public.money_rows where counts;

-- =====================================================================
-- 5. one mechanism: the old stores feed identifiers while anything still writes to them
-- =====================================================================
create or replace function public.company_identifier_ensure(p_business uuid, p_kind text, p_value text, p_source text,
                                                            p_from date default null, p_to date default null)
returns void language plpgsql security definer set search_path to public as $$
declare holder uuid;
begin
  if public.ident_norm(p_kind, p_value) is null then return; end if;
  select c.business_id into holder from company_identifiers c
   where c.kind = p_kind and c.value_norm = public.ident_norm(p_kind, p_value) and c.removed_at is null;
  if holder = p_business then return; end if;
  if holder is not null then
    raise exception 'This % already belongs to another company — one identifier, one company', p_kind using errcode = '23505';
  end if;
  insert into company_identifiers (business_id, kind, value, source, valid_from, valid_to)
  values (p_business, p_kind, p_value, p_source, case when p_kind = 'discount_code' then p_from end, case when p_kind = 'discount_code' then p_to end);
end $$;
create or replace function public.company_identifier_drop(p_business uuid, p_kind text, p_value text)
returns void language sql security definer set search_path to public as $$
  update company_identifiers set removed_at = now()
  where business_id = p_business and kind = p_kind and value_norm = public.ident_norm(p_kind, p_value) and removed_at is null
$$;
-- the feeds of the old stores never block the old writers while they last: a value that may not be an identifier (under an
-- exclusion rule) or that another company holds is left out, and said so
create or replace function public.company_identifier_feed(p_business uuid, p_kind text, p_value text, p_source text,
                                                          p_from date default null, p_to date default null)
returns void language plpgsql security definer set search_path to public as $$
begin
  perform public.company_identifier_ensure(p_business, p_kind, p_value, p_source, p_from, p_to);
exception when unique_violation or check_violation then
  raise notice 'not an identifier of this company: % "%" (%)', p_kind, p_value, sqlerrm;
end $$;
revoke all on function public.company_identifier_ensure(uuid, text, text, text, date, date) from public, anon;
revoke all on function public.company_identifier_feed(uuid, text, text, text, date, date) from public, anon;
revoke all on function public.company_identifier_drop(uuid, text, text) from public, anon;

-- a billing profile's client ID is an identifier of its company (the won handover writes client_profiles)
create or replace function public.client_profiles_feed_identifiers() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op = 'UPDATE' and (new.business_id is distinct from old.business_id or new.direct_client_id is distinct from old.direct_client_id) then
    perform public.company_identifier_drop(old.business_id, 'client_id', old.direct_client_id);
  end if;
  if nullif(btrim(coalesce(new.direct_client_id, '')), '') is not null then
    perform public.company_identifier_feed(new.business_id, 'client_id', new.direct_client_id, 'billing_profile');
  end if;
  return null;
end $$;
drop trigger if exists client_profiles_feed_identifiers on public.client_profiles;
create trigger client_profiles_feed_identifiers after insert or update of business_id, direct_client_id on public.client_profiles
  for each row execute function public.client_profiles_feed_identifiers();

create or replace function public.discount_links_feed_identifiers() returns trigger language plpgsql security definer set search_path to public as $$
declare p record;
begin
  select pc.code, pc.valid_from, pc.valid_to into p from promo_codes pc where pc.id = new.promo_code_id;
  if p.code is null then return null; end if;
  if tg_op = 'INSERT' and new.removed_at is null then
    perform public.company_identifier_feed(new.business_id, 'discount_code', p.code, 'moved', p.valid_from, p.valid_to);
  elsif tg_op = 'UPDATE' and old.removed_at is null and new.removed_at is not null then
    perform public.company_identifier_drop(new.business_id, 'discount_code', p.code);
  end if;
  return null;
end $$;
drop trigger if exists discount_links_feed_identifiers on public.company_discount_codes;
create trigger discount_links_feed_identifiers after insert or update of removed_at on public.company_discount_codes
  for each row execute function public.discount_links_feed_identifiers();

create or replace function public.name_aliases_feed_identifiers() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op = 'INSERT' and new.removed_at is null then
    perform public.company_identifier_feed(new.business_id, 'name', new.name, 'moved');
  elsif tg_op = 'UPDATE' and old.removed_at is null and new.removed_at is not null then
    perform public.company_identifier_drop(new.business_id, 'name', new.name);
  end if;
  return null;
end $$;
drop trigger if exists name_aliases_feed_identifiers on public.company_name_aliases;
create trigger name_aliases_feed_identifiers after insert or update of removed_at on public.company_name_aliases
  for each row execute function public.name_aliases_feed_identifiers();

-- a company merge carries the dropped company's own identifiers to the kept one (the codes and names of the old stores
-- follow through their feeds above), and undoing the merge takes them back
create or replace function public.business_merges_carry_identifiers() returns trigger language plpgsql security definer set search_path to public as $$
declare x record; nid uuid; moved jsonb := '[]'::jsonb;
begin
  if tg_op = 'INSERT' then
    for x in select * from company_identifiers where business_id = new.dropped_id and removed_at is null order by created_at loop
      update company_identifiers set removed_at = now() where id = x.id;
      if not exists (select 1 from company_identifiers where kind = x.kind and value_norm = x.value_norm and removed_at is null) then
        insert into company_identifiers (business_id, kind, value, source, valid_from, valid_to, note)
        values (new.kept_id, x.kind, x.value, 'merge', x.valid_from, x.valid_to, x.note) returning id into nid;
        moved := moved || jsonb_build_object('removed', x.id, 'added', nid);
      end if;
    end loop;
    new.moved := coalesce(new.moved, '{}'::jsonb) || jsonb_build_object('company_identifiers', moved);
    return new;
  end if;
  if old.undone_at is null and new.undone_at is not null then
    for x in select * from jsonb_array_elements(coalesce(new.moved->'company_identifiers', '[]'::jsonb)) e(v) loop
      update company_identifiers set removed_at = now() where id = (x.v->>'added')::uuid and removed_at is null;
      update company_identifiers c set removed_at = null where c.id = (x.v->>'removed')::uuid and c.removed_at is not null
        and not exists (select 1 from company_identifiers d where d.kind = c.kind and d.value_norm = c.value_norm and d.removed_at is null);
    end loop;
  end if;
  return new;
end $$;
-- named to run after business_merges_carry_typed (alphabetical), so the old stores' feeds have moved codes and names first
drop trigger if exists business_merges_carry_zidentifiers on public.business_merges;
create trigger business_merges_carry_zidentifiers before insert or update on public.business_merges
  for each row execute function public.business_merges_carry_identifiers();

-- =====================================================================
-- 6. the copy, once: what the old stores hold today becomes identifiers (a value two companies claim, or one under an
--    exclusion rule, is left out and named)
-- =====================================================================
do $$
declare x record; n int := 0; skipped text := '';
begin
  for x in
    select cp.business_id, 'client_id' as kind, cp.direct_client_id as value, 'billing_profile' as src, null::date as vf, null::date as vt
      from client_profiles cp where nullif(btrim(coalesce(cp.direct_client_id, '')), '') is not null
    union all
    select l.business_id, 'discount_code', p.code, 'moved', p.valid_from, p.valid_to
      from company_discount_codes l join promo_codes p on p.id = l.promo_code_id where l.removed_at is null
    union all
    select a.business_id, 'name', a.name, 'moved', null, null from company_name_aliases a where a.removed_at is null
  loop
    begin
      perform public.company_identifier_ensure(x.business_id, x.kind, x.value, x.src, x.vf, x.vt); n := n + 1;
    exception when others then skipped := skipped || format(' · %s %s (%s)', x.kind, x.value, sqlerrm);
    end;
  end loop;
  raise notice 'company identifiers: % copied from the old stores%', n, case when skipped <> '' then '; left out:' || skipped else '' end;
end $$;
