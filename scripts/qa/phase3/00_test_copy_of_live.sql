-- Stand-ins for objects that ALREADY exist in the live direct-business database
-- (definitions copied from production, 25 Sep 2026). Local testing only.
create extension if not exists pgcrypto;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.uid', true), '')::uuid $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

create type user_role as enum ('admin','manager','bd','operations','viewer','team_member');
create table app_users (
  id uuid primary key default gen_random_uuid(), email text unique not null,
  full_name text, name_ar text, nickname text, role user_role not null default 'team_member',
  active boolean not null default true, page_access jsonb, created_at timestamptz default now());

-- copied from production
create or replace function app_role() returns user_role language sql stable security definer set search_path to public as
$$ select role from public.app_users where id = auth.uid() and active $$;
-- copied from production 2026-09-25 (Phase 1a, scripts/sql/phase1a-access-levels.sql)
create or replace function public.access_pages()
returns text[] language sql immutable set search_path to 'public' as $$
  select array['today','leads','clients','offers','documents','ops','reports','finance','settings',
               'events','airlines','vendors','sopsla','activity','archive',
               'projects','bookings','invoices','tickets','sync']
$$;

-- one word per level, whichever vocabulary it was stored in
create or replace function public.level_word(v text)
returns text language sql immutable set search_path to 'public' as $$
  select case v when 'full' then 'full' when 'editor' then 'full'
                when 'own' then 'own'
                when 'view' then 'view' when 'viewer' then 'view'
                else 'none' end
$$;

create or replace function public.level_rank(v text)
returns int language sql immutable set search_path to 'public' as $$
  select case public.level_word(v) when 'full' then 3 when 'own' then 2 when 'view' then 1 else 0 end
$$;

-- the starting grid a role gets — matches what each role can do today (seed from today)
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;

-- THE check. Every other access question in the database is answered through this.
create or replace function public.page_level(p text)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when p is null or not (p = any(public.access_pages())) then 'none'
    when public.app_role() is null then 'none'
    when public.app_role() = 'admin' then 'full'
    else (select case when public.level_word(u.page_access->>p) = 'none' and p = 'today' then 'view'
                      else public.level_word(u.page_access->>p) end
            from public.app_users u where u.id = auth.uid() and u.active)
  end
$$;

create or replace function public.page_access(p text)
returns text language sql stable security definer set search_path to 'public' as $$
  select case public.page_level(p) when 'full' then 'editor' when 'own' then 'own'
                                   when 'view' then 'viewer' else null end
$$;
create or replace function public.can_see_page(p text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.page_level(p) <> 'none'
$$;
create or replace function public.can_edit_page(p text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.page_level(p) = 'full'
$$;

create or replace function public.app_users_page_access_guard()
returns trigger language plpgsql set search_path to 'public' as $$
declare k text; v text;
begin
  -- only a NEW person, or someone moving down from admin, is given a starting grid: an admin who
  -- takes every page away from someone must not see the defaults quietly come back
  if new.role <> 'admin' and (new.page_access is null or new.page_access = '{}'::jsonb)
     and (tg_op = 'INSERT' or old.role = 'admin') then
    new.page_access := public.default_page_levels(new.role);
  end if;
  if new.page_access is not null then
    if jsonb_typeof(new.page_access) <> 'object' then
      raise exception 'page_access must be an object' using errcode = '22023';
    end if;
    for k, v in select key, value #>> '{}' from jsonb_each(new.page_access) loop
      if not (k = any(public.access_pages())) then
        raise exception 'Unknown page in page_access: %', k using errcode = '22023';
      end if;
      if v is null or v not in ('editor','viewer','full','view','own','none') then
        raise exception 'Unknown level in page_access: % = %', k, v using errcode = '22023';
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists trg_app_users_page_access_guard on public.app_users;
create trigger trg_app_users_page_access_guard
  before insert or update of page_access, role on public.app_users
  for each row execute function public.app_users_page_access_guard();


create table document_counters (family text, year integer, last_n integer, primary key (family, year));
create or replace function next_document_number(p_family text) returns text language plpgsql security definer set search_path to public as $$
declare y integer := extract(year from now())::integer; n integer;
begin
  if app_role() is null then raise exception 'not allowed'; end if;
  insert into document_counters(family, year, last_n) values (upper(p_family), y, 1)
    on conflict (family, year) do update set last_n = document_counters.last_n + 1
    returning last_n into n;
  return upper(p_family) || '-' || y || '-' || lpad(n::text, 3, '0');
end $$;

create table businesses (
  id uuid primary key default gen_random_uuid(), legacy_id text, name text not null, name_ar text,
  stage text, is_client boolean default false, assigned_to text, account_manager text,
  direct_client_id text, next_action_date date, next_action_note text, cr_vat text, legal_name text, contract_start date, contract_end date, contract_scope text, payment_terms text, credit_limit numeric,
  archived_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table contacts (id uuid primary key default gen_random_uuid(), business_id uuid references businesses(id), name text);
create table ksa_events (id uuid primary key default gen_random_uuid(), name_en text, name_ar text, start_date date);
create table client_profiles (id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade, direct_client_id text unique, profile_type text);
create table finance_client_links (id uuid primary key default gen_random_uuid(), client_group text unique,
  business_id uuid references businesses(id) on delete set null, is_client boolean);
create table finance_invoices (
  id uuid primary key default gen_random_uuid(), invoice_no text, line_no integer, zatca_dpin text,
  client_group text, invoice_date date, service_type text, salesman text, project_tag text,
  total_incl_vat_sar numeric, wallet_portion_sar numeric, vat_sar numeric,
  revenue_sar numeric, cost_sar numeric, profit_sar numeric,
  amount_received_sar numeric, amount_remaining_sar numeric,
  integrity_status text, exclusion_reason text, source_batch text, revenue_way text,
  deleted_at timestamptz, updated_at timestamptz default now(),
  unique (invoice_no, line_no));
alter table finance_invoices enable row level security;
create policy fin_inv_read on finance_invoices for select using (can_see_page('finance'));
create policy fin_inv_write on finance_invoices for all using (can_edit_page('finance')) with check (can_edit_page('finance'));
alter table finance_client_links enable row level security;
create policy fin_link_read on finance_client_links for select using (can_see_page('finance'));
create table generated_documents (id uuid primary key default gen_random_uuid(), business_id uuid references businesses(id),
  family text, doc_number text, title text, payload jsonb, status text, created_at timestamptz default now());
alter table businesses enable row level security;
create policy biz_read on businesses for select using (app_role() is not null);
create policy biz_write on businesses for all using (app_role() is not null) with check (app_role() is not null);

create table record_history (id bigserial primary key, at timestamptz not null default now(), actor uuid, actor_name text,
  table_name text not null, record_id uuid, action text not null, before_row jsonb, after_row jsonb,
  undone_at timestamptz, undone_by uuid);
-- copied from production
create or replace function record_history_write() returns trigger language plpgsql security definer set search_path to public as $$
declare a uuid; n text; act text; b jsonb; f jsonb;
begin
  a := auth.uid();
  select coalesce(full_name, email) into n from app_users where id = a;
  if TG_OP='INSERT' then act:='create'; b:=null; f:=to_jsonb(NEW);
  elsif TG_OP='DELETE' then act:='delete'; b:=to_jsonb(OLD); f:=null;
  else
    b:=to_jsonb(OLD); f:=to_jsonb(NEW); act:='edit';
    if TG_TABLE_NAME='businesses' then
      if OLD.archived_at is null and NEW.archived_at is not null then act:='archive';
      elsif OLD.archived_at is not null and NEW.archived_at is null then act:='restore'; end if;
    else
      if (b->>'deleted_at') is null and (f->>'deleted_at') is not null then act:='delete';
      elsif (b->>'deleted_at') is not null and (f->>'deleted_at') is null then act:='restore'; end if;
    end if;
    if b = f then return NEW; end if;
  end if;
  insert into record_history(actor, actor_name, table_name, record_id, action, before_row, after_row)
  values (a, coalesce(n,'unknown'), TG_TABLE_NAME, coalesce((f->>'id')::uuid, (b->>'id')::uuid), act, b, f);
  return coalesce(NEW, OLD);
end $$;
-- client IDs (one company: 1..n Direct client IDs, each tender / prepaid / postpaid) — already live
alter table client_profiles add column status text, add column payment_terms text, add column credit_limit_sar numeric,
  add column tender_amount_sar numeric, add column opened_at date, add column closed_at timestamptz, add column notes text;
-- discount / promo codes registry — already live (B2C invoices, not the B2B finance)
create table promo_codes (id uuid primary key default gen_random_uuid(), code text unique, kind text, value_pct numeric,
  valid_from date, valid_to date, total_sales_sar numeric, total_discount_sar numeric, active boolean default true,
  expired boolean default false, partner_business_id uuid references businesses(id), notes text, created_at timestamptz default now());
