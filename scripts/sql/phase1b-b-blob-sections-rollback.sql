-- Undo phase1b-b-blob-sections.sql: both save functions exactly as they were (read 2026-09-25).
create or replace function public.save_state(payload jsonb)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare cur_data jsonb;
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

  insert into public.app_state(id, data, updated_at, updated_by)
  values (1, payload, now(), (select email from public.app_users where id = auth.uid()))
  on conflict (id) do update
    set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by;
end;
$function$;
create or replace function public.save_state_patch(patch jsonb)
 returns timestamp with time zone language plpgsql security definer set search_path to 'public' as $function$
declare new_ts timestamptz;
begin
  if public.app_role() not in ('admin','manager','bd','operations','team_member') then
    raise exception 'not authorized to save';
  end if;

  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be a json object';
  end if;

  -- leads live in public.businesses and are never written through this blob
  patch := patch - 'businesses';

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
drop function if exists public.log_sections_kept(text[]);
drop function if exists public.blob_section_writable(text);
drop table if exists public.blob_section_pages;
