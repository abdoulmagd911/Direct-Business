-- Phase 1b, part E — Leads and Clients: owners are ACCOUNTS, and "own work" is enforced. 2026-09-25.
--
-- Ownership was a typed name (assigned_to), which the database cannot check. Now every company also
-- carries owner_id — the account that name belongs to — worked out BY THE DATABASE on every insert
-- and update from assigned_to (the app writes that column and the raw blob in step on all 112 rows,
-- measured). owner_id is never taken from the caller: a value sent in is ignored and recomputed, so
-- nobody can claim a company by writing an id.
-- Name → account: the account whose full name, Arabic name, nickname (either language) or e-mail
-- prefix equals the name — only when exactly ONE account matches, or when owner_name_preference
-- names the account for that name (one entry: the owner's two admin addresses share his name, and
-- his primary address is preferred — owner's ruling 2026-09-25). No match = no owner.
-- Measured before this: 80 live leads all map (77 to exactly one account, 3 through the preference);
-- 8 of 28 live clients carry an owner name and all 8 map; 20 clients have no owner anywhere and stay
-- unowned (owner's ruling: only Full control changes them until someone is assigned).
--
-- Writes: a company belongs to Leads or Clients by is_client. Full control on that page writes any
-- company; Own work writes only companies whose owner_id is the caller — and cannot give one away or
-- create one for somebody else (the WITH CHECK side sees the new owner). Contacts, activities and
-- client profiles follow their company. Reading is unchanged (open to every signed-in employee).
-- Everyone live today has Full on both pages (or is an admin), so nobody's day changes.
-- Rollback: phase1b-e-leads-clients-own-work-rollback.sql.

create table if not exists public.owner_name_preference(
  name_key text primary key,          -- lower(trim(name))
  user_id  uuid not null references public.app_users(id) on delete cascade
);
alter table public.owner_name_preference enable row level security;
drop policy if exists owner_name_preference_read on public.owner_name_preference;
create policy owner_name_preference_read on public.owner_name_preference for select to authenticated using (public.app_role() is not null);

-- which accounts answer to a name
create or replace function public.owner_candidates(nm text)
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select u.id from public.app_users u
   where coalesce(trim(nm),'') <> ''
     and lower(trim(nm)) in (lower(trim(coalesce(u.full_name,''))), lower(trim(coalesce(u.name_ar,''))),
                            lower(trim(coalesce(u.nickname,''))), lower(trim(coalesce(u.nickname_ar,''))),
                            lower(split_part(u.email,'@',1)))
$$;

create or replace function public.resolve_owner(nm text)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select p.user_id from public.owner_name_preference p where p.name_key = lower(trim(nm))),
    (select case when count(*) = 1 then min(c::text)::uuid end from public.owner_candidates(nm) c))
$$;

-- the one ambiguity in the live data: a name two admin accounts share → the owner's primary address
insert into public.owner_name_preference(name_key, user_id)
select lower(trim(b.assigned_to)), (select u.id from public.app_users u where u.email = 'business@directksa.com')
  from public.businesses b
 where coalesce(trim(b.assigned_to),'') <> ''
   and (select count(*) from public.owner_candidates(b.assigned_to)) > 1
   and exists (select 1 from public.owner_candidates(b.assigned_to) c join public.app_users u on u.id = c where u.email = 'business@directksa.com')
group by 1
on conflict (name_key) do nothing;

alter table public.businesses add column if not exists owner_id uuid references public.app_users(id) on delete set null;
create index if not exists businesses_owner_id_idx on public.businesses(owner_id);

-- fill in the owners without touching the history log or "last changed" (a derived key, not an edit)
alter table public.businesses disable trigger user;
update public.businesses set owner_id = public.resolve_owner(assigned_to);
alter table public.businesses enable trigger user;

-- from now on the database keeps it, from the name, on every write — whatever the caller sent
create or replace function public.businesses_owner_sync()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.owner_id := public.resolve_owner(new.assigned_to);
  return new;
end $$;
drop trigger if exists trg_businesses_owner_sync on public.businesses;
create trigger trg_businesses_owner_sync before insert or update on public.businesses
  for each row execute function public.businesses_owner_sync();

-- may the signed-in person write a company of this kind with this owner?
create or replace function public.can_write_company(p_is_client boolean, p_owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case public.page_level(case when coalesce(p_is_client,false) then 'clients' else 'leads' end)
           when 'full' then true
           when 'own'  then p_owner is not null and p_owner = auth.uid()
           else false end
$$;
-- …and a record hanging off a company (contact, activity, client profile)
create or replace function public.can_write_company_id(p_business uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select public.can_write_company(b.is_client, b.owner_id) from public.businesses b where b.id = p_business),
                  public.can_edit_page('leads'))    -- a record with no company: Leads, full control
$$;

drop policy if exists biz_write on public.businesses;
create policy biz_write on public.businesses for all
  using (public.can_write_company(is_client, owner_id))
  with check (public.can_write_company(is_client, owner_id));
drop policy if exists con_write on public.contacts;
create policy con_write on public.contacts for all
  using (public.can_write_company_id(business_id)) with check (public.can_write_company_id(business_id));
drop policy if exists act_write on public.activities;
create policy act_write on public.activities for all
  using (public.can_write_company_id(business_id)) with check (public.can_write_company_id(business_id));
drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles for all
  using (public.can_write_company_id(business_id)) with check (public.can_write_company_id(business_id));
-- merging two companies stays an admin / manager act, and now also needs full control of the pages
drop policy if exists bm_write on public.business_merges;
create policy bm_write on public.business_merges for all
  using (public.app_role() in ('admin','manager') and (public.can_edit_page('leads') or public.can_edit_page('clients')))
  with check (public.app_role() in ('admin','manager') and (public.can_edit_page('leads') or public.can_edit_page('clients')));
