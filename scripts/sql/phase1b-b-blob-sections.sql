-- Phase 1b, part B — the shared workspace blob (app_state) learns which page owns each section. 2026-09-25.
--
-- Before: save_state (whole-blob replace) and save_state_patch (section merge) checked the ROLE only,
-- so any team member's browser could overwrite Airlines, Suppliers, SOPs, the company's bank and tax
-- details (`agency`) or Settings. Now each section belongs to a page, and a section is written only by
-- someone with FULL control of that page. Admins write everything.
-- The save is NEVER refused as a whole: a section the caller may not change is left exactly as stored
-- and the rest of the save goes through. Reason: a browser re-sends sections it never meant to change
-- (the funnel layer writes its defaults into settings on load — js/35's notes), so refusing the whole
-- save would break an employee's ordinary work. A held-back section that DIFFERED from the stored copy
-- is written to the history log (table 'access', action 'sections_kept'), once per person per day per
-- set of sections, so nothing is dropped unseen.
-- Owner rulings kept: Airlines, Suppliers, SOP & SLA stay in the blob, View / Full only.
-- Rollback: phase1b-b-blob-sections-rollback.sql.

create table if not exists public.blob_section_pages(
  section text primary key,
  page    text,          -- null = any active account may write it (per-person or system sections)
  note    text
);
alter table public.blob_section_pages enable row level security;
drop policy if exists blob_section_pages_read on public.blob_section_pages;
create policy blob_section_pages_read on public.blob_section_pages for select to authenticated using (public.app_role() is not null);
-- no write policy: changed only by a migration

insert into public.blob_section_pages(section, page, note) values
  ('airlines','airlines',null), ('ndcProviders','airlines','NDC provider notes on the airline register'),
  ('vendors','vendors',null),
  ('sops','sopsla',null), ('sopsWhale','sopsla',null), ('slas','sopsla',null),
  ('ksaEvents','events','blob copy; the live events are the ksa_events table'),
  ('settings','settings',null), ('agency','settings','company bank / tax details'), ('integrations','settings',null),
  ('offers','offers','blob copy of app_offers'), ('templateLibrary','offers',null), ('bundleTemplates','offers',null), ('serviceFeePricing','offers',null),
  ('requests','ops','blob copy of app_requests'), ('projects','projects','blob copy of app_projects'),
  ('bookings','bookings','blob copy of app_bookings'), ('travelerProfiles','bookings',null),
  ('invoices','invoices','blob copy of app_invoices'), ('refundRequests','invoices',null),
  ('syncEvents','sync',null),
  ('recents',null,'per-person recently opened'), ('meta',null,'system'), ('schemaVersion',null,'system'),
  ('audit',null,'old append-only log, no longer grown (js/53)')
on conflict (section) do update set page = excluded.page, note = excluded.note;

-- may the signed-in person write this section of the blob?
create or replace function public.blob_section_writable(s text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when public.app_role() is null then false
    when public.app_role() = 'admin' then true
    when s like '\_%' then true                                   -- one-off migration flags
    when exists (select 1 from public.blob_section_pages b where b.section = s and b.page is null) then true
    when exists (select 1 from public.blob_section_pages b where b.section = s) then
         (select public.can_edit_page(b.page) from public.blob_section_pages b where b.section = s)
    else false                                                      -- a section nobody mapped: admins only
  end
$$;

-- log the sections that were held back, once per person per day per set
create or replace function public.log_sections_kept(kept text[])
returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); nm text;
begin
  if kept is null or array_length(kept,1) is null or me is null then return; end if;
  if exists (select 1 from public.record_history
              where actor = me and table_name = 'access' and action = 'sections_kept'
                and at > now() - interval '1 day'
                and after_row->'sections' = to_jsonb(kept)) then return; end if;
  select coalesce(nullif(full_name,''), email) into nm from public.app_users where id = me;
  insert into public.record_history(actor, actor_name, table_name, record_id, action, before_row, after_row)
  values (me, nm, 'access', me, 'sections_kept', null, jsonb_build_object('sections', to_jsonb(kept)));
end $$;
revoke all on function public.log_sections_kept(text[]) from public, anon, authenticated;

create or replace function public.save_state_patch(patch jsonb)
returns timestamp with time zone language plpgsql security definer set search_path to 'public' as $function$
declare new_ts timestamptz; cur jsonb; k text; kept text[] := '{}';
begin
  if public.app_role() not in ('admin','manager','bd','operations','team_member') then
    raise exception 'not authorized to save';
  end if;
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be a json object';
  end if;
  -- leads live in public.businesses and are never written through this blob
  patch := patch - 'businesses';
  select data into cur from public.app_state where id = 1;
  -- Phase 1b: a section the caller may not change is left as stored
  for k in select jsonb_object_keys(patch) loop
    if not public.blob_section_writable(k) then
      if (cur -> k) is distinct from (patch -> k) then kept := kept || k; end if;
      patch := patch - k;
    end if;
  end loop;
  perform public.log_sections_kept(kept);

  update public.app_state
     set data       = coalesce(data, '{}'::jsonb) || patch,
         updated_at = now(),
         updated_by = (select email from public.app_users where id = auth.uid())
   where id = 1
  returning updated_at into new_ts;

  if new_ts is null then
    insert into public.app_state(id, data, updated_at, updated_by)
    values (1, patch, now(), (select email from public.app_users where id = auth.uid()))
    returning updated_at into new_ts;
  end if;
  return new_ts;
end;
$function$;

create or replace function public.save_state(payload jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare cur_data jsonb; k text; kept text[] := '{}';
begin
  if public.app_role() not in ('admin','manager','bd','operations','team_member') then
    raise exception 'not authorized to save';
  end if;

  select data into cur_data from public.app_state where id = 1;

  -- never accept leads through the blob; keep the stored copy as-is
  payload := payload - 'businesses';
  if cur_data ? 'businesses' then
    payload := payload || jsonb_build_object('businesses', cur_data->'businesses');
  end if;

  -- Phase 1b: this call REPLACES the whole blob (js/19 falls back to it when a patch fails), so every
  -- section the caller may not change — sent, changed or left out — is put back exactly as stored
  for k in select key from jsonb_each(coalesce(cur_data,'{}'::jsonb)) union select key from jsonb_each(coalesce(payload,'{}'::jsonb)) loop
    if k <> 'businesses' and not public.blob_section_writable(k) then
      if (cur_data -> k) is distinct from (payload -> k) then kept := kept || k; end if;
      if cur_data ? k then payload := payload || jsonb_build_object(k, cur_data -> k);
      else payload := payload - k; end if;
    end if;
  end loop;
  perform public.log_sections_kept(kept);

  insert into public.app_state(id, data, updated_at, updated_by)
  values (1, payload, now(), (select email from public.app_users where id = auth.uid()))
  on conflict (id) do update
    set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by;
end;
$function$;
