-- Rollback of phase3-r4-company-card.sql — puts back release 1's rules exactly. Links and the two new file columns are
-- KEPT (dropping them would lose recorded work); nothing reads them once the screens are rolled back.
drop trigger if exists client_profiles_card_guard on client_profiles;
drop function if exists client_profiles_card_guard();

drop policy if exists company_client_files_read on storage.objects;
drop policy if exists company_client_files_insert on storage.objects;
drop policy if exists company_docs_read on storage.objects;
create policy company_docs_read on storage.objects for select using ((bucket_id = 'company-docs'::text) and (app_role() is not null));
drop policy if exists company_docs_write on storage.objects;
create policy company_docs_write on storage.objects for insert with check ((bucket_id = 'company-docs'::text) and can_edit_page('documents'::text));
drop policy if exists company_docs_update on storage.objects;
create policy company_docs_update on storage.objects for update using ((bucket_id = 'company-docs'::text) and can_edit_page('documents'::text));

drop policy if exists cd_read on company_documents;
drop policy if exists cd_insert on company_documents;
drop policy if exists cd_update on company_documents;
create policy cd_read on company_documents for select using (can_see_page('clients') or can_see_page('leads') or (open_visibility() and app_role() is not null));
create policy cd_write on company_documents for all using (can_edit_page('clients') or can_edit_page('leads')) with check (can_edit_page('clients') or can_edit_page('leads'));
grant delete on company_documents to authenticated;
create or replace function company_documents_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.client_profile_id is not null and not exists (select 1 from client_profiles where id=new.client_profile_id and business_id=new.business_id) then
    raise exception 'That client ID belongs to a different company'; end if;
  if tg_op='INSERT' and new.uploaded_by is null then new.uploaded_by := my_member_id(); end if;
  return new;
end $$;

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
     from promo_codes p where p.partner_business_id = b.id) as discount_codes,
  (select jsonb_object_agg(d.doc_type, d.n) from (select doc_type, count(*) n from company_documents where business_id = b.id and deleted_at is null group by doc_type) d) as documents,
  array(select x from unnest(array['cr','vat','agreement']) x
        where not exists (select 1 from company_documents d where d.business_id = b.id and d.doc_type = x and d.deleted_at is null)) as missing_documents,
  (select count(*) from company_documents d where d.business_id = b.id and d.deleted_at is null and d.valid_to < work_today()) as expired_documents,
  (select count(*) from company_open_work w where w.business_id = b.id) as open_tasks
from businesses b;

drop function if exists company_file_readable(text);
drop function if exists company_file_uploadable(text);
drop function if exists company_documents_presence(uuid);
drop function if exists company_doc_readable(text);
drop policy if exists cdc_read on company_discount_codes;
drop policy if exists cdc_insert on company_discount_codes;
drop policy if exists cdc_update on company_discount_codes;
-- company_discount_codes itself is kept (its rows are history); with no policies left, nobody but the owner role reads it.
