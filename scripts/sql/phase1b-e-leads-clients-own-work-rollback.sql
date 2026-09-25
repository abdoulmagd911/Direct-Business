-- Undo phase1b-e-leads-clients-own-work.sql: the rules exactly as they were (read 2026-09-25).
-- owner_id is dropped last; nothing else reads it.
drop policy if exists biz_write on public.businesses;
create policy biz_write on public.businesses for all using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists con_write on public.contacts;
create policy con_write on public.contacts for all using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists act_write on public.activities;
create policy act_write on public.activities for all using (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','operations','team_member']::user_role[]));
drop policy if exists client_profiles_write on public.client_profiles;
create policy client_profiles_write on public.client_profiles for all using (app_role() = any (array['admin','manager','bd','team_member']::user_role[])) with check (app_role() = any (array['admin','manager','bd','team_member']::user_role[]));
drop policy if exists bm_write on public.business_merges;
create policy bm_write on public.business_merges for all using (app_role() = any (array['admin','manager']::user_role[])) with check (app_role() = any (array['admin','manager']::user_role[]));
drop trigger if exists trg_businesses_owner_sync on public.businesses;
drop function if exists public.businesses_owner_sync();
drop function if exists public.can_write_company_id(uuid);
drop function if exists public.can_write_company(boolean, uuid);
alter table public.businesses drop column if exists owner_id;
drop function if exists public.resolve_owner(text);
drop function if exists public.owner_candidates(text);
drop table if exists public.owner_name_preference;
