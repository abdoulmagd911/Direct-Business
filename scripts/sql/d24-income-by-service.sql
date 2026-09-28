-- D24 — Income by service (owner, 28 Sep, via the oversight). Rollback: d24-income-by-service.rollback.sql. No data changes
-- here; the starting lists are a separate file (d24-income-by-service-defaults.sql), applied only on the oversight's word.
--   · money_services: the main services, a list a person keeps on Finance → Rules (Flights, Hotels, Transportation, Visas,
--     Study abroad, Packages, Journey Solutions, Other income …). A service marked "not income" is never counted (Direct
--     Wallet, Techtic).
--   · money_product_services: which service a Payments PRODUCT goes to by default (Direct Flights → Flights …).
--   · money_item_services: an ITEM can override its product's service (Chauffeur Service → Transportation). Keyed on the
--     item — the first part of a line's name ("Chauffeur Service - 3rd Party Fee" → "Chauffeur Service"), a whole name when it
--     has no dash — because the item-name list (pass-through / fee) keys on the LAST part, which many items share.
--   · money_line_services: every invoice line with its service — the item's own service first, else its product's.
--   · money_service_rows: per invoice and service, the revenue of its lines and the pass-through among them. Finance adds
--     these up per service for the invoices that count; nothing is stored per service.
-- Who may change the lists: Full on Finance (the owner's rule for Finance Rules, D22). Everyone who sees Finance reads them.
-- Every change is in the change log; nothing is ever deleted (removed, and kept).

create or replace function public.money_list_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare who uuid := coalesce(auth.uid(), public.qa_user_id());
        nm text := (select coalesce(nullif(u.full_name, ''), u.email) from app_users u where u.id = coalesce(auth.uid(), public.qa_user_id()));
        key_new text; key_old text;
begin
  key_new := to_jsonb(new) ->> (case tg_table_name when 'money_services' then 'name' when 'money_product_services' then 'product' else 'item' end);
  if tg_op = 'INSERT' then
    new.created_by := who; new.created_by_name := nm; new.created_at := now();
    new.updated_by := null; new.updated_by_name := null; new.updated_at := null;
    new.removed_by := null; new.removed_by_name := null; new.removed_at := null; return new; end if;
  key_old := to_jsonb(old) ->> (case tg_table_name when 'money_services' then 'name' when 'money_product_services' then 'product' else 'item' end);
  if old.removed_at is not null then raise exception 'A removed entry stays removed — add it again if it is needed'; end if;
  if key_new is distinct from key_old or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'A name never changes — remove it and add it again'; end if;
  if new.removed_at is not null then new.removed_at := now(); new.removed_by := who; new.removed_by_name := nm; end if;
  new.updated_at := now(); new.updated_by := who; new.updated_by_name := nm;
  return new;
end $$;

create table if not exists public.money_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_norm text generated always as (public.money_norm(name)) stored,
  sort_order int not null default 100,
  counts_as_income boolean not null default true,        -- false: lines of this service are never income (Direct Wallet, Techtic)
  note text,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  updated_by uuid, updated_by_name text, updated_at timestamptz,
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint money_service_readable check (public.money_norm(name) is not null));
create unique index if not exists money_services_one_live on public.money_services (name_norm) where removed_at is null;

create table if not exists public.money_product_services (
  id uuid primary key default gen_random_uuid(),
  product text not null,                                  -- the Payments product as the export writes it ("Direct Flights")
  product_norm text generated always as (public.money_norm(product)) stored,
  service_id uuid not null references public.money_services(id),
  note text,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  updated_by uuid, updated_by_name text, updated_at timestamptz,
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint money_product_readable check (public.money_norm(product) is not null));
create unique index if not exists money_product_services_one_live on public.money_product_services (product_norm) where removed_at is null;

-- the item of a line: the part before the first dash ("Chauffeur Service - 3rd Party Fee" → "Chauffeur Service")
create or replace function public.money_item_head(n text) returns text language sql immutable parallel safe as $$
  select public.money_norm(btrim(regexp_replace(coalesce(n, ''), '\s[-–—|]\s.*$', '')))
$$;

create table if not exists public.money_item_services (
  id uuid primary key default gen_random_uuid(),
  item text not null,                                     -- as a person types it: "Chauffeur Service"
  item_norm text generated always as (public.money_item_head(item)) stored,
  service_id uuid not null references public.money_services(id),
  note text,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  updated_by uuid, updated_by_name text, updated_at timestamptz,
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint money_item_service_readable check (public.money_item_head(item) is not null));
create unique index if not exists money_item_services_one_live on public.money_item_services (item_norm) where removed_at is null;

do $t$
declare t text;
begin
  foreach t in array array['money_services', 'money_product_services', 'money_item_services'] loop
    execute format('drop trigger if exists %1$s_guard on public.%1$s', t);
    execute format('create trigger %1$s_guard before insert or update on public.%1$s for each row execute function public.money_list_guard()', t);
    execute format('drop trigger if exists %1$s_no_delete on public.%1$s', t);
    execute format('create trigger %1$s_no_delete before delete on public.%1$s for each row execute function public.block_hard_delete()', t);
    execute format('drop trigger if exists trg_record_history on public.%1$s', t);
    execute format('create trigger trg_record_history after insert or update or delete on public.%1$s for each row execute function public.record_history_write()', t);
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.can_see_page(''finance''))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.can_edit_page(''finance''))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.can_edit_page(''finance'')) with check (public.can_edit_page(''finance''))', t);
    execute format('revoke all on public.%1$s from anon', t);
    execute format('grant select, insert, update on public.%1$s to authenticated', t);
  end loop;
end $t$;

-- every line with its service: the item name's own service first, else its product's; a removed service counts as none
create or replace view public.money_line_services with (security_invoker = on) as
select l.invoice_no, l.line_no, l.product, l.name, l.item_total_sar, c.class,
       s.id as service_id, s.name as service_name, s.sort_order, coalesce(s.counts_as_income, true) as counts_as_income,
       case when cs.id is not null then 'item' when ps.id is not null then 'product' end as mapped_by
from public.finance_invoice_lines l
left join public.money_item_classes c on c.removed_at is null and c.name_norm = public.money_item_key(l.name)
left join public.money_item_services it on it.removed_at is null and it.item_norm = public.money_item_head(l.name)
left join public.money_services cs on cs.removed_at is null and cs.id = it.service_id
left join public.money_product_services p on p.removed_at is null and p.product_norm = public.money_norm(l.product)
left join public.money_services ps on ps.removed_at is null and ps.id = p.service_id
left join public.money_services s on s.id = coalesce(cs.id, ps.id)
where coalesce(l.kind, 'item') = 'item';
grant select on public.money_line_services to authenticated;
revoke all on public.money_line_services from anon;

-- per invoice and service: the revenue of its lines and the pass-through among them (lines that are never income left out)
create or replace view public.money_service_rows with (security_invoker = on) as
select i.id, x.service_id, x.service_name, x.sort_order,
       sum(x.item_total_sar) as revenue_sar,
       sum(x.item_total_sar) filter (where x.class = 'pass_through') as pass_through_sar,
       count(*) as lines
from public.finance_invoices i
join public.money_line_services x on x.invoice_no = i.invoice_no
where i.deleted_at is null and x.counts_as_income
group by i.id, x.service_id, x.service_name, x.sort_order;
grant select on public.money_service_rows to authenticated;
revoke all on public.money_service_rows from anon;

