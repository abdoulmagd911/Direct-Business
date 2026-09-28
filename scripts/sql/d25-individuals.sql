-- D25 — "Individual (not a company)": a decision in Finance → Rules → Needs a decision (the oversight, 28 Sep, F22).
-- Rollback: d25-individuals.rollback.sql. No data changes; needs d24 (money_list_guard).
--   · money_individuals: customer names a person marked as a private individual. They leave "Needs a decision", and their
--     imported invoices are listed (read-only) on Finance → Individual bookings. They still count as revenue — an individual's
--     paid invoice is a sale like any other (D21); this only says it is not a company.
-- Anyone with Full on Finance adds or removes one (no role, as the other Rules lists); everyone who sees Finance reads them;
-- every change is in the change log; nothing is deleted.
create or replace function public.money_list_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare who uuid := coalesce(auth.uid(), public.qa_user_id());
        nm text := (select coalesce(nullif(u.full_name, ''), u.email) from app_users u where u.id = coalesce(auth.uid(), public.qa_user_id()));
        key_new text; key_old text;
        k text := case tg_table_name when 'money_product_services' then 'product' when 'money_item_services' then 'item' else 'name' end;
begin
  key_new := to_jsonb(new) ->> k;
  if tg_op = 'INSERT' then
    new.created_by := who; new.created_by_name := nm; new.created_at := now();
    new.updated_by := null; new.updated_by_name := null; new.updated_at := null;
    new.removed_by := null; new.removed_by_name := null; new.removed_at := null; return new; end if;
  key_old := to_jsonb(old) ->> k;
  if old.removed_at is not null then raise exception 'A removed entry stays removed — add it again if it is needed'; end if;
  if key_new is distinct from key_old or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'A name never changes — remove it and add it again'; end if;
  if new.removed_at is not null then new.removed_at := now(); new.removed_by := who; new.removed_by_name := nm; end if;
  new.updated_at := now(); new.updated_by := who; new.updated_by_name := nm;
  return new;
end $$;

create table if not exists public.money_individuals (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                    -- the customer name as Payments writes it
  name_norm text generated always as (public.money_norm(name)) stored,
  note text,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  updated_by uuid, updated_by_name text, updated_at timestamptz,
  removed_by uuid, removed_by_name text, removed_at timestamptz,
  constraint money_individual_readable check (public.money_norm(name) is not null));
create unique index if not exists money_individuals_one_live on public.money_individuals (name_norm) where removed_at is null;
drop trigger if exists money_individuals_guard on public.money_individuals;
create trigger money_individuals_guard before insert or update on public.money_individuals for each row execute function public.money_list_guard();
drop trigger if exists money_individuals_no_delete on public.money_individuals;
create trigger money_individuals_no_delete before delete on public.money_individuals for each row execute function public.block_hard_delete();
drop trigger if exists trg_record_history on public.money_individuals;
create trigger trg_record_history after insert or update or delete on public.money_individuals for each row execute function public.record_history_write();
alter table public.money_individuals enable row level security;
drop policy if exists money_individuals_read on public.money_individuals;
create policy money_individuals_read on public.money_individuals for select to authenticated using (public.can_see_page('finance'));
drop policy if exists money_individuals_insert on public.money_individuals;
create policy money_individuals_insert on public.money_individuals for insert to authenticated with check (public.can_edit_page('finance'));
drop policy if exists money_individuals_update on public.money_individuals;
create policy money_individuals_update on public.money_individuals for update to authenticated
  using (public.can_edit_page('finance')) with check (public.can_edit_page('finance'));
revoke all on public.money_individuals from anon;
grant select, insert, update on public.money_individuals to authenticated;
