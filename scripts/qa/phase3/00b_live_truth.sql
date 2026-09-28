-- what the LIVE database says on 2026-09-25 where the test stub (29e) differs — measured with pg_get_functiondef / pg_policy
create or replace function public.next_document_number(p_family text) returns text language plpgsql security definer set search_path to 'public' as $function$
declare y integer := extract(year from now())::integer; n integer;
begin
  if app_role() is null then raise exception 'not allowed'; end if;
  if not public.can_edit_page('documents') then
    raise exception 'Only someone with full control of the Generator can issue a document number.' using errcode = '42501';
  end if;
  insert into document_counters(family, year, last_n) values (upper(p_family), y, 1)
    on conflict (family, year) do update set last_n = document_counters.last_n + 1
    returning last_n into n;
  return upper(p_family) || '-' || y || '-' || lpad(n::text, 3, '0');
end $function$;
create or replace function public.default_page_levels(r public.user_role) returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end $$;
alter table record_history enable row level security;
create policy record_history_read on record_history for select to authenticated using (
  case when table_name = any (array['finance_invoices','finance_transactions','finance_client_links']) then can_see_page('finance') else true end);
-- live Phase 1b-E owner resolution, and the live Undo (copied from production 2026-09-25)
alter table app_users add column if not exists nickname_ar text;
create table if not exists owner_name_preference(name_key text primary key, user_id uuid not null references app_users(id) on delete cascade);
alter table owner_name_preference enable row level security;
create policy owner_name_preference_read on owner_name_preference for select to authenticated using (public.app_role() is not null);
create or replace function public.owner_candidates(nm text) returns setof uuid language sql stable security definer set search_path to 'public' as $function$
  select u.id from public.app_users u
   where coalesce(trim(nm),'') <> ''
     and lower(trim(nm)) in (lower(trim(coalesce(u.full_name,''))), lower(trim(coalesce(u.name_ar,''))),
                            lower(trim(coalesce(u.nickname,''))), lower(trim(coalesce(u.nickname_ar,''))),
                            lower(split_part(u.email,'@',1)))
$function$;
create or replace function public.resolve_owner(nm text) returns uuid language sql stable security definer set search_path to 'public' as $function$
  select coalesce(
    (select p.user_id from public.owner_name_preference p where p.name_key = lower(trim(nm))),
    (select case when count(*) = 1 then min(c::text)::uuid end from public.owner_candidates(nm) c))
$function$;
CREATE OR REPLACE FUNCTION public.undo_change(p_id bigint)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare h record; me uuid; my_role text; win interval := interval '24 hours'; cols text; pg text; pg_word text;
begin
  me := auth.uid();
  select role::text into my_role from app_users where id = me and active;
  if me is null or my_role is null then
    return 'You must be signed in with an active account to undo a change.';
  end if;
  select * into h from record_history where id = p_id;
  if h.id is null            then return 'That change is not in the log.'; end if;
  if h.undone_at is not null then return 'Already undone.'; end if;
  if now() - h.at > win      then return 'Too old to undo — this only works within 24 hours. Ask an admin to restore it.'; end if;
  if h.action = 'create'     then return 'Undoing a newly created record is not an undo — delete it instead, which is itself logged.'; end if;
  if h.before_row is null    then return 'Nothing to put back.'; end if;
  if h.table_name = 'businesses' then
    pg := case when coalesce((h.before_row->>'is_client')::boolean, false) then 'clients' else 'leads' end;
  elsif h.table_name in ('contacts','activities') then
    select case when b.is_client then 'clients' else 'leads' end into pg
      from businesses b where b.id::text = h.before_row->>'business_id';
    pg := coalesce(pg, 'leads');
  elsif h.table_name = 'client_profiles' then
    pg := 'clients';
  elsif h.table_name in ('finance_invoices','finance_transactions','finance_client_links') then
    pg := 'finance';
  else
    return 'This kind of change cannot be undone here.';
  end if;
  if not public.can_edit_page(pg) then
    pg_word := case pg when 'leads' then 'Leads' when 'clients' then 'Clients' when 'finance' then 'Finance' else pg end;
    return 'Undoing this needs full control of the ' || pg_word || ' page.';
  end if;
  if h.table_name in ('finance_invoices','finance_transactions') then
    if coalesce(my_role,'') not in ('admin','manager') then
      return 'Money records can only be undone by an admin or a manager.'; end if;
  elsif h.actor is distinct from me and coalesce(my_role,'') not in ('admin','manager') then
    return 'You can undo your own changes; an admin or manager can undo anyone''s.';
  end if;
  if h.action = 'delete' and h.after_row is null and coalesce(my_role,'') <> 'admin' then
    return 'Bringing back a fully deleted record is an admin action.'; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name=h.table_name
    and is_generated='NEVER' and is_identity='NO';
  if h.after_row is null then
    execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1)',
                   h.table_name, cols, cols, h.table_name) using h.before_row;
  else
    execute format('update %I set (%s) = (select %s from jsonb_populate_record(null::%I, $1)) where id = $2',
                   h.table_name, cols, cols, h.table_name) using h.before_row, h.record_id;
  end if;
  update record_history set undone_at = now(), undone_by = me where id = p_id;
  return 'ok';
end$function$;
-- promo_codes as it is live (information_schema, 2026-09-25): the columns the 12–13 Aug import wrote
alter table promo_codes add column if not exists slug text, add column if not exists created_by text,
  add column if not exists updated_at timestamptz not null default now();
update promo_codes set kind = 'percent' where kind is null;
update promo_codes set total_sales_sar = 0 where total_sales_sar is null;
update promo_codes set total_discount_sar = 0 where total_discount_sar is null;
alter table promo_codes alter column kind set not null, alter column kind set default 'percent',
  alter column total_sales_sar set not null, alter column total_sales_sar set default 0,
  alter column total_discount_sar set not null, alter column total_discount_sar set default 0,
  alter column active set not null, alter column expired set not null, alter column code set not null;
-- businesses.owner_id, the owner ACCOUNT (Phase 1b-E, live since 2026-09-25)
alter table businesses add column if not exists owner_id uuid references app_users(id) on delete set null;
-- the live history trigger on companies, contacts and client profiles (as on production)
drop trigger if exists trg_record_history on businesses;
create trigger trg_record_history after insert or update or delete on businesses for each row execute function record_history_write();
drop trigger if exists trg_record_history on contacts;
create trigger trg_record_history after insert or update or delete on contacts for each row execute function record_history_write();
drop trigger if exists trg_record_history on client_profiles;
create trigger trg_record_history after insert or update or delete on client_profiles for each row execute function record_history_write();

-- ---------- release 4 (2026-09-26): the company-write rules and client_profiles as live, read from the live database ----------
alter table businesses add column if not exists owner_id uuid;
alter table client_profiles add column if not exists updated_at timestamptz default now();
create or replace function public.can_write_company(p_is_client boolean, p_owner uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select case public.page_level(case when coalesce(p_is_client,false) then 'clients' else 'leads' end)
           when 'full' then true
           when 'own'  then p_owner is not null and p_owner = auth.uid()
           else false end
$$;
create or replace function public.can_write_company_id(p_business uuid) returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select public.can_write_company(b.is_client, b.owner_id) from public.businesses b where b.id = p_business),
                  public.can_edit_page('leads'))
$$;
-- businesses write rule as live (audit 2026-09-27: the test copy let anyone signed in write any company; live does not)
drop policy if exists biz_write on businesses;
create policy biz_write on businesses for all using (can_write_company(is_client, owner_id)) with check (can_write_company(is_client, owner_id));
alter table client_profiles add constraint client_profiles_profile_type_check check (profile_type = any (array['prepaid','postpaid','tender']));
create unique index if not exists client_profiles_one_open_prepaid_postpaid on client_profiles (business_id, profile_type)
  where profile_type = any (array['prepaid','postpaid']) and closed_at is null;
alter table client_profiles enable row level security;
drop policy if exists client_profiles_read on client_profiles;
create policy client_profiles_read on client_profiles for select using (app_role() is not null);
drop policy if exists client_profiles_write on client_profiles;
create policy client_profiles_write on client_profiles for all using (can_write_company_id(business_id)) with check (can_write_company_id(business_id));
grant select, insert, update, delete on client_profiles to authenticated;

-- ---------- people & teams (2026-09-27): the login table's rules and the directory view, as live ----------
-- A signed-in person reads only their own login row (an admin reads all); only an admin writes. The directory view
-- runs with the caller's rights (security_invoker), so it adds no way around those rules.
alter table app_users enable row level security;
drop policy if exists app_users_admin_read on app_users;
create policy app_users_admin_read on app_users for select using (app_role() = 'admin');
drop policy if exists app_users_self_read on app_users;
create policy app_users_self_read on app_users for select using (id = auth.uid() or app_role() = 'admin');
drop policy if exists app_users_admin_update on app_users;
create policy app_users_admin_update on app_users for update using (app_role() = 'admin') with check (app_role() = 'admin');
drop policy if exists app_users_admin_write on app_users;
create policy app_users_admin_write on app_users for all using (app_role() = 'admin') with check (app_role() = 'admin');
grant select, insert, update, delete on app_users to authenticated;
create or replace view public.team_directory with (security_invoker = on) as
  select id, email, full_name, name_ar, nickname, role, active from public.app_users;
grant select on public.team_directory to authenticated;

-- ---------- E, the money rules (2026-09-27): finance_invoices columns and app_settings as live ----------
alter table finance_invoices add column if not exists customer_raw_name text, add column if not exists transaction_ref text,
  add column if not exists collection_due_date date, add column if not exists record_type text,
  add column if not exists created_at timestamptz default now();
create table if not exists app_settings (id text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz default now());
alter table app_settings enable row level security;
-- business_merges as live (information_schema, 2026-09-27) — written by the live-only fn_merge_businesses
create table if not exists business_merges (id uuid primary key default gen_random_uuid(), kept_id uuid, dropped_id uuid,
  dropped_snapshot jsonb, kept_before jsonb, moved jsonb, reason text, actor text, merged_at timestamptz default now(),
  undone_at timestamptz, undone_by text);
alter table business_merges enable row level security;
drop policy if exists bm_read on business_merges;
create policy bm_read on business_merges for select using (app_role() is not null);
drop policy if exists bm_write on business_merges;
create policy bm_write on business_merges for all using (app_role() in ('admin','manager') and (can_edit_page('leads') or can_edit_page('clients')))
  with check (app_role() in ('admin','manager') and (can_edit_page('leads') or can_edit_page('clients')));
grant select, insert, update on business_merges to authenticated;

-- ---------- D1 prerequisites (2026-09-28): the rest of finance_invoices, the capture tables and the derive trigger, as live
-- (information_schema read 2026-09-28; the defaults and NOT NULLs are live's, so D1's "drop not null" is really tested) ----------
alter table finance_invoices
  add column if not exists customer_raw_name text, add column if not exists month text, add column if not exists quarter text,
  add column if not exists year integer, add column if not exists products text, add column if not exists notes text,
  add column if not exists created_at timestamptz default now(), add column if not exists branch text,
  add column if not exists discount_sar numeric, add column if not exists origin text, add column if not exists proposal_ref text,
  add column if not exists items jsonb, add column if not exists direct_uuid text;
update finance_invoices set cost_sar = coalesce(cost_sar, 0), profit_sar = coalesce(profit_sar, 0);
alter table finance_invoices alter column cost_sar set default 0, alter column cost_sar set not null,
                             alter column profit_sar set default 0, alter column profit_sar set not null;
create table if not exists finance_expense_lines_capture (id bigserial primary key, transaction_ref text, amount_sar numeric,
  expense_status text, source_batch text);
create table if not exists finance_expense_gate_capture (transaction_ref text primary key, txn_expense_status text,
  invoice_issuing_raw text, source_batch text, captured_at timestamptz);
grant select, insert, update, delete on finance_expense_lines_capture, finance_expense_gate_capture to authenticated;
alter table finance_expense_lines_capture enable row level security; alter table finance_expense_gate_capture enable row level security;   -- as live
drop policy if exists felc_all on finance_expense_lines_capture; create policy felc_all on finance_expense_lines_capture for all using (can_edit_page('finance')) with check (can_edit_page('finance'));
drop policy if exists fegc_all on finance_expense_gate_capture; create policy fegc_all on finance_expense_gate_capture for all using (can_edit_page('finance')) with check (can_edit_page('finance'));
grant usage, select on all sequences in schema public to authenticated;
create or replace function public.finance_derive_fields() returns trigger language plpgsql as $$
begin
  new.month := to_char(new.invoice_date, 'FMMonth'); new.quarter := 'Q' || to_char(new.invoice_date, 'Q');
  if abs((new.total_incl_vat_sar - new.wallet_portion_sar) - new.revenue_sar) > 0.01 then
    new.revenue_sar := round(new.total_incl_vat_sar - new.wallet_portion_sar, 2); end if;
  if abs((new.revenue_sar - new.cost_sar) - new.profit_sar) > 0.01 then new.profit_sar := round(new.revenue_sar - new.cost_sar, 2); end if;
  if new.integrity_status in ('excluded','credit_note') then new.amount_remaining_sar := 0; end if;
  return new;
end $$;
drop trigger if exists trg_fin_inv_derive on finance_invoices;
create trigger trg_fin_inv_derive before insert or update on finance_invoices for each row execute function finance_derive_fields();
-- D22 (28 Sep): stand-ins for the live tables D22 changes that the test copy did not carry, with their live rules as read
-- from pg_policies on 28 Sep (before D22) — so the harness can prove D22 moves each one to the page level
create table if not exists finance_cogs_expenses (id uuid primary key default gen_random_uuid(), amount_sar numeric, note text);
create table if not exists finance_transactions (id uuid primary key default gen_random_uuid(), business_id uuid, amount_sar numeric);
create table if not exists payment_receipts (id uuid primary key default gen_random_uuid(), amount_sar numeric);
create table if not exists finance_targets (id uuid primary key default gen_random_uuid(), year int, revenue_sar numeric);
create table if not exists contact_submissions_review (id uuid primary key default gen_random_uuid(), note text);
create table if not exists offers (id uuid primary key default gen_random_uuid(), business_id uuid, title text);
create table if not exists requests (id uuid primary key default gen_random_uuid(), business_id uuid, title text);
create table if not exists funnels (id uuid primary key default gen_random_uuid(), name text);
create table if not exists external_refs (id uuid primary key default gen_random_uuid(), business_id uuid, ref text);
create table if not exists app_state_history (id bigserial primary key, data jsonb, created_at timestamptz default now());
do $$ declare t text; begin
  foreach t in array array['finance_cogs_expenses','finance_transactions','payment_receipts','finance_targets','contact_submissions_review',
                           'offers','requests','funnels','external_refs','app_state_history'] loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop; end $$;
drop policy if exists finance_cogs_expenses_read on finance_cogs_expenses; create policy finance_cogs_expenses_read on finance_cogs_expenses for select using (app_role() is not null);
drop policy if exists finance_cogs_expenses_write on finance_cogs_expenses; create policy finance_cogs_expenses_write on finance_cogs_expenses for all
  using (can_edit_page('finance') and app_role() = any (array['admin','manager','operations']::user_role[])) with check (can_edit_page('finance') and app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists finance_transactions_read on finance_transactions; create policy finance_transactions_read on finance_transactions for select using (app_role() is not null);
drop policy if exists finance_transactions_write on finance_transactions; create policy finance_transactions_write on finance_transactions for all
  using (can_edit_page('finance') and app_role() = any (array['admin','manager','operations']::user_role[])) with check (can_edit_page('finance') and app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists payment_receipts_read on payment_receipts; create policy payment_receipts_read on payment_receipts for select using (app_role() is not null);
drop policy if exists payment_receipts_write on payment_receipts; create policy payment_receipts_write on payment_receipts for all
  using (can_edit_page('finance') and app_role() = any (array['admin','manager','operations']::user_role[])) with check (can_edit_page('finance') and app_role() = any (array['admin','manager','operations']::user_role[]));
drop policy if exists finance_targets_read on finance_targets; create policy finance_targets_read on finance_targets for select using (app_role() is not null);
drop policy if exists finance_targets_write on finance_targets; create policy finance_targets_write on finance_targets for all using (can_edit_page('finance')) with check (can_edit_page('finance'));
drop policy if exists csr_read on contact_submissions_review; create policy csr_read on contact_submissions_review for select using (app_role() is not null);
drop policy if exists csr_write on contact_submissions_review; create policy csr_write on contact_submissions_review for all
  using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop policy if exists off_read on offers; create policy off_read on offers for select using (app_role() is not null);
drop policy if exists off_write on offers; create policy off_write on offers for all
  using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists req_read on requests; create policy req_read on requests for select using (app_role() is not null);
drop policy if exists req_write on requests; create policy req_write on requests for all
  using (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[]));
drop policy if exists funnels_read on funnels; create policy funnels_read on funnels for select to authenticated using (app_role() is not null);
drop policy if exists funnels_write on funnels; create policy funnels_write on funnels for all to authenticated
  using (app_role() = any (array['admin','manager','bd']::user_role[])) with check (app_role() = any (array['admin','manager','bd']::user_role[]));
drop policy if exists ext_read on external_refs; create policy ext_read on external_refs for select using (app_role() is not null);
drop policy if exists ext_write on external_refs; create policy ext_write on external_refs for all
  using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists hist_admin_read on app_state_history; create policy hist_admin_read on app_state_history for select using (app_role() = 'admin'::user_role);
alter table promo_codes enable row level security;   -- as live (every public table has row security on; checked 28 Sep)
