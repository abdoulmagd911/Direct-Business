-- Phase 3 release 4 — the company card (2026-09-26). Builds on release 1's company_documents / company_card and on
-- client_profiles (the Direct Payments client IDs). D6: this app records WHICH Direct Payments client IDs a company has
-- and links out to them; it never copies Direct Payments' data. D7: everyone on Clients stays on Full control, every
-- change is in record_history. The money rule (approved 2026-09-25): IBAN letters and agreements are readable by
-- managers and admins only — enforced here, in the table AND in the file store, not only hidden on screen.
-- Checked against the live database before writing (2026-09-26, read-only): client_profiles 36 rows / 27 companies,
-- 0 duplicate or blank IDs, the most OPEN IDs any company holds is 2 (one company has 4 rows, 2 of them closed);
-- company_documents 0 rows; promo_codes 200 rows, none linked; bucket company-docs private, but its read rule let
-- ANY signed-in person read every file in it.
-- Rollback: phase3-r4-company-card.rollback.sql.

-- =====================================================================
-- 1. CLIENT IDs — at most 3 OPEN per company; unique across companies (already a unique key); no stray spaces
-- =====================================================================
create or replace function client_profiles_card_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  new.direct_client_id := btrim(new.direct_client_id);   -- " 95" and "95" are the same Direct Payments client
  if new.direct_client_id is null or new.direct_client_id = '' then
    raise exception 'A client ID needs the number Direct Payments gave it'; end if;
  if new.closed_at is null and (tg_op = 'INSERT' or old.closed_at is not null or new.business_id is distinct from old.business_id) then
    perform pg_advisory_xact_lock(hashtext('client_profiles:' || new.business_id::text));   -- two people adding at once cannot both be the 3rd
    if (select count(*) from client_profiles c where c.business_id = new.business_id and c.closed_at is null and c.id <> new.id) >= 3 then
      raise exception 'A company holds at most 3 open client IDs — close one before adding another'; end if;
  end if;
  return new;
end $$;
drop trigger if exists client_profiles_card_guard on client_profiles;
create trigger client_profiles_card_guard before insert or update on client_profiles for each row execute function client_profiles_card_guard();

-- =====================================================================
-- 2. DISCOUNT CODES — a company is LINKED to an existing code; the codes themselves are never written
--    (the 200 rows and promo_codes_guard stay exactly as they are). B2C codes: a link is a note of who a code is for;
--    nothing on the Finance side reads this table, so a link never becomes B2B money.
-- =====================================================================
create table if not exists company_discount_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete restrict,
  promo_code_id uuid not null references promo_codes(id) on delete restrict,
  note text,
  linked_by uuid default auth.uid(), linked_at timestamptz not null default now(),
  removed_at timestamptz, removed_by uuid);
create unique index if not exists company_discount_codes_one_company on company_discount_codes(promo_code_id) where removed_at is null;
create index if not exists company_discount_codes_business on company_discount_codes(business_id) where removed_at is null;
alter table company_discount_codes enable row level security;
create or replace function company_discount_codes_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op = 'INSERT' then
    new.linked_by := auth.uid(); new.linked_at := now(); new.removed_at := null; new.removed_by := null;
    return new; end if;
  if old.removed_at is not null then raise exception 'A removed link stays removed — link the code again if it is needed'; end if;
  if new.business_id is distinct from old.business_id or new.promo_code_id is distinct from old.promo_code_id
     or new.linked_by is distinct from old.linked_by or new.linked_at is distinct from old.linked_at then
    raise exception 'A link is never re-pointed — remove it and link again'; end if;
  if new.removed_at is not null then new.removed_at := now(); new.removed_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists company_discount_codes_guard on company_discount_codes;
create trigger company_discount_codes_guard before insert or update on company_discount_codes for each row execute function company_discount_codes_guard();
drop trigger if exists company_discount_codes_no_delete on company_discount_codes;
create trigger company_discount_codes_no_delete before delete on company_discount_codes for each row execute function block_hard_delete();
drop trigger if exists trg_record_history on company_discount_codes;
create trigger trg_record_history after insert or update or delete on company_discount_codes for each row execute function record_history_write();
drop policy if exists cdc_read on company_discount_codes;
create policy cdc_read on company_discount_codes for select using (can_see_page('clients'));
drop policy if exists cdc_insert on company_discount_codes;
create policy cdc_insert on company_discount_codes for insert with check (can_write_company_id(business_id));
drop policy if exists cdc_update on company_discount_codes;
create policy cdc_update on company_discount_codes for update using (can_write_company_id(business_id)) with check (can_write_company_id(business_id));
grant select, insert, update on company_discount_codes to authenticated;
revoke all on company_discount_codes from anon;

-- =====================================================================
-- 3. COMPANY FILES — insert-only, soft-removed, never re-pointed; IBAN letters and agreements for managers and admins
-- =====================================================================
alter table company_documents add column if not exists created_by uuid default auth.uid();
alter table company_documents add column if not exists deleted_by uuid;

-- who may READ a file of this type: the money files (IBAN letter, agreement) → managers and admins; the rest → the
-- Clients page level. A removed file keeps the same rule (it is kept for the record; the card lists live files only).
create or replace function company_doc_readable(p_type text) returns boolean language sql stable security definer set search_path to public as $$
  select case when p_type in ('iban','agreement') then is_manager() and can_see_page('clients') else can_see_page('clients') end
$$;
revoke all on function company_doc_readable(text) from public, anon;
grant execute on function company_doc_readable(text) to authenticated;

create or replace function company_documents_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.client_profile_id is not null and not exists (select 1 from client_profiles where id=new.client_profile_id and business_id=new.business_id) then
    raise exception 'That client ID belongs to a different company'; end if;
  if tg_op = 'INSERT' then
    if new.uploaded_by is null then new.uploaded_by := my_member_id(); end if;
    new.created_by := auth.uid(); new.created_at := now(); new.deleted_at := null; new.deleted_by := null;
    -- the file lives at clients/<company>/<this row>/<name>: the path names its row, so the file store can ask the row
    -- what kind of file it is (who may read it), and a file can never be moved onto another company or row
    if new.storage_path is null or new.storage_path not like 'clients/' || new.business_id::text || '/' || new.id::text || '/%' then
      raise exception 'A company file is stored at clients/<company>/<file id>/<name>'; end if;
    return new; end if;
  if old.deleted_at is not null then raise exception 'A removed file stays removed — upload it again if it is needed'; end if;
  if new.business_id is distinct from old.business_id or new.client_profile_id is distinct from old.client_profile_id
     or new.doc_type is distinct from old.doc_type or new.storage_path is distinct from old.storage_path
     or new.file_name is distinct from old.file_name or new.mime_type is distinct from old.mime_type
     or new.size_bytes is distinct from old.size_bytes or new.uploaded_by is distinct from old.uploaded_by
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'A company file is never re-pointed — remove it and upload the right one'; end if;
  if new.deleted_at is not null then new.deleted_at := now(); new.deleted_by := auth.uid(); end if;
  return new;   -- what may change: its title, its expiry date, and removing it
end $$;
-- (the trigger company_documents_guard from release 1 already calls this function; history + no-delete triggers stay)

drop policy if exists cd_read on company_documents;
create policy cd_read on company_documents for select using (company_doc_readable(doc_type));
drop policy if exists cd_write on company_documents;
drop policy if exists cd_insert on company_documents;
create policy cd_insert on company_documents for insert with check (can_write_company_id(business_id));
drop policy if exists cd_update on company_documents;
create policy cd_update on company_documents for update using (can_write_company_id(business_id) and company_doc_readable(doc_type))
  with check (can_write_company_id(business_id));
revoke delete on company_documents from authenticated;

-- how many files of each kind a company has — for everyone who can see Clients, so "agreement: on file" shows even to
-- someone who may not open it (counts only: no names, no paths)
create or replace function company_documents_presence(p_business uuid) returns jsonb language sql stable security definer set search_path to public as $$
  select case when can_see_page('clients') then coalesce((select jsonb_object_agg(doc_type, n) from
    (select doc_type, count(*) n from company_documents where business_id = p_business and deleted_at is null group by doc_type) d), '{}'::jsonb) end
$$;
revoke all on function company_documents_presence(uuid) from public, anon;
grant execute on function company_documents_presence(uuid) to authenticated;

-- the file store: the row is written first, then the file is stored at exactly the row's path, once
create or replace function company_file_readable(p_name text) returns boolean language sql stable security definer set search_path to public as $$
  select coalesce((select company_doc_readable(d.doc_type) from company_documents d where d.storage_path = p_name), false)
$$;
create or replace function company_file_uploadable(p_name text) returns boolean language sql stable security definer set search_path to public as $$
  select coalesce((select d.deleted_at is null and d.created_by = auth.uid() and can_write_company_id(d.business_id)
                   from company_documents d where d.storage_path = p_name), false)
$$;
revoke all on function company_file_readable(text), company_file_uploadable(text) from public, anon;
grant execute on function company_file_readable(text), company_file_uploadable(text) to authenticated;

insert into storage.buckets(id, name, public) values ('company-docs', 'company-docs', false) on conflict (id) do nothing;
-- Direct's own company assets (the Generator's registry) keep their rules — but those rules no longer reach clients/…
drop policy if exists company_docs_read on storage.objects;
create policy company_docs_read on storage.objects for select using (bucket_id = 'company-docs' and name not like 'clients/%' and app_role() is not null);
drop policy if exists company_docs_write on storage.objects;
create policy company_docs_write on storage.objects for insert with check (bucket_id = 'company-docs' and name not like 'clients/%' and can_edit_page('documents'));
drop policy if exists company_docs_update on storage.objects;
create policy company_docs_update on storage.objects for update using (bucket_id = 'company-docs' and name not like 'clients/%' and can_edit_page('documents'));
-- client company files: read by the row's rule; stored once, by whoever wrote the row; never updated, never deleted
drop policy if exists company_client_files_read on storage.objects;
create policy company_client_files_read on storage.objects for select using (bucket_id = 'company-docs' and name like 'clients/%' and company_file_readable(name));
drop policy if exists company_client_files_insert on storage.objects;
create policy company_client_files_insert on storage.objects for insert with check (bucket_id = 'company-docs' and name like 'clients/%' and company_file_uploadable(name));

-- =====================================================================
-- 4. THE CARD VIEW — discount codes from the links (and any import that set partner_business_id); files counted
--    through company_documents_presence so a money file shows as "on file" to everyone who may see the company
-- =====================================================================
create or replace view company_card with (security_invoker = on) as
select b.id as business_id, b.name, b.name_ar, b.account_manager, b.cr_vat,
  b.contract_start, b.contract_end, b.contract_scope,
  (select jsonb_agg(jsonb_build_object('client_id', c.direct_client_id, 'type', c.profile_type, 'status', c.status,
      'payment_terms', c.payment_terms, 'credit_limit_sar', c.credit_limit_sar, 'tender_amount_sar', c.tender_amount_sar) order by c.profile_type)
     from client_profiles c where c.business_id = b.id) as client_ids,
  (select count(*) from client_profiles c where c.business_id = b.id) as client_id_count,
  company_owner_member(b.id) as account_manager_member_id,
  (select jsonb_agg(jsonb_build_object('code', p.code, 'kind', p.kind, 'value', p.value_pct, 'services', p.services, 'purpose', p.purpose,
      'valid_from', p.valid_from, 'valid_to', p.valid_to,
      'status', case when not coalesce(p.active,true) then 'off' when coalesce(p.expired,false) or p.valid_to < work_today() then 'expired'
                     when p.valid_from > work_today() then 'upcoming' else 'active' end) order by p.valid_to desc nulls last)
     from promo_codes p where p.partner_business_id = b.id
        or exists (select 1 from company_discount_codes l where l.promo_code_id = p.id and l.business_id = b.id and l.removed_at is null)) as discount_codes,
  company_documents_presence(b.id) as documents,
  array(select x from unnest(array['cr','vat','agreement']) x where not coalesce(company_documents_presence(b.id) ? x, false)) as missing_documents,
  (select count(*) from company_documents d where d.business_id = b.id and d.deleted_at is null and d.valid_to < work_today()) as expired_documents,
  (select count(*) from company_open_work w where w.business_id = b.id) as open_tasks
from businesses b;
