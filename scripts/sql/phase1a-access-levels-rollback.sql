-- Undo phase1a-access-levels.sql: the definitions below are exactly what was live before it
-- (read from the database 2026-09-25). If phase1a-rename-levels.sql has also run, run
-- phase1a-rename-levels-rollback.sql FIRST, or the old checks will not recognise 'full'/'view'.
drop trigger if exists trg_app_users_page_access_guard on public.app_users;
drop function if exists public.app_users_page_access_guard();

create or replace function public.page_access(p text)
 returns text language sql stable security definer set search_path to 'public' as $function$
  select case
    when public.app_role() = 'admin' then 'editor'
    else (select u.page_access->>p from public.app_users u where u.id = auth.uid() and u.active)
  end
$function$;
create or replace function public.can_see_page(p text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce(public.page_access(p) in ('editor','viewer'), false)
$function$;
create or replace function public.can_edit_page(p text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce(public.page_access(p) = 'editor', false)
$function$;

drop function if exists public.set_page_levels(uuid, jsonb);
drop function if exists public.my_page_levels();
drop function if exists public.page_level(text);
drop function if exists public.default_page_levels(public.user_role);
drop function if exists public.level_rank(text);
drop function if exists public.level_word(text);
drop function if exists public.access_pages();
