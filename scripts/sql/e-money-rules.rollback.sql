-- Rollback of e-money-rules.sql. Puts finance_lines, the client-ID guard (cap of 3) and the company-write rules back as
-- they were. The rules people typed are dropped with their table (they stay in record_history). The two settings lists
-- removed in step 5 are NOT restored here: restore them from the backup taken before the apply (golive-backups bucket).
create or replace view public.finance_lines with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, l.business_id, i.revenue_sar, i.cost_sar, i.profit_sar,
       i.amount_received_sar, i.amount_remaining_sar,
       ((i.cost_sar is null) or (i.cost_sar = 0::numeric)) as cost_missing, i.source_batch
from public.finance_invoices i
left join public.finance_client_links l on l.client_group = i.client_group
where i.deleted_at is null and i.exclusion_reason is null and i.integrity_status = 'verified_paid';

drop view if exists public.money_that_counts;
drop view if exists public.money_rows;
drop function if exists public.money_row_rules();
drop table if exists public.money_exclusion_rules;
drop function if exists public.money_exclusion_rules_guard();

create or replace function public.client_profiles_card_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  new.direct_client_id := btrim(new.direct_client_id);
  if new.direct_client_id is null or new.direct_client_id = '' then
    raise exception 'A client ID needs the number Direct Payments gave it'; end if;
  if new.closed_at is null and (tg_op = 'INSERT' or old.closed_at is not null or new.business_id is distinct from old.business_id) then
    perform pg_advisory_xact_lock(hashtext('client_profiles:' || new.business_id::text));
    if (select count(*) from client_profiles c where c.business_id = new.business_id and c.closed_at is null and c.id <> new.id) >= 3 then
      raise exception 'A company holds at most 3 open client IDs — close one before adding another'; end if;
  end if;
  return new;
end $$;

drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles for all
  using (public.can_write_company_id(business_id)) with check (public.can_write_company_id(business_id));
drop policy if exists cdc_insert on public.company_discount_codes;
create policy cdc_insert on public.company_discount_codes for insert with check (public.can_write_company_id(business_id));
drop policy if exists cdc_update on public.company_discount_codes;
create policy cdc_update on public.company_discount_codes for update
  using (public.can_write_company_id(business_id)) with check (public.can_write_company_id(business_id));

alter table public.finance_invoices drop column if exists payments_client_id, drop column if exists customer_tax_no,
  drop column if exists discount_code;
drop function if exists public.money_norm(text);
