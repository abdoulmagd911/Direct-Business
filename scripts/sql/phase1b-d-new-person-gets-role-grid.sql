-- Phase 1b, part D — a person added through Team → Add gets their role's starting grid. 2026-09-25.
-- Found reading the admin-users function: it creates the login FIRST (handle_new_user then files the
-- person as an unapproved 'viewer' with the {"today":"view"} starting grid, because the allowlist row
-- is written only afterwards) and sets the real role SECOND. The 1a guard gave starting grids on
-- INSERT only, so a new employee would have opened Today and nothing else.
-- Now: when the role changes on someone still holding the untouched sign-up grid (none, empty, or
-- exactly {"today":"view"}), they are given the new role's starting grid. Anyone whose grid was
-- actually set keeps it — a role change still never closes a page (js/56's standing rule).
-- Rollback: re-create the guard exactly as in scripts/sql/phase1a-access-levels.sql.
create or replace function public.app_users_page_access_guard()
returns trigger language plpgsql set search_path to 'public' as $$
declare k text; v text;
begin
  -- only a NEW person, or someone moving down from admin, is given a starting grid: an admin who
  -- takes every page away from someone must not see the defaults quietly come back
  if new.role <> 'admin' and (new.page_access is null or new.page_access = '{}'::jsonb)
     and (tg_op = 'INSERT' or old.role = 'admin') then
    new.page_access := public.default_page_levels(new.role);
  end if;
  -- a role set on someone who still holds the untouched sign-up grid (Team → Add sets the role
  -- AFTER the sign-up row exists) gets the new role's starting grid
  if tg_op = 'UPDATE' and new.role <> 'admin' and new.role is distinct from old.role
     and new.page_access is not distinct from old.page_access
     and (old.page_access is null or old.page_access = '{}'::jsonb or old.page_access = '{"today":"view"}'::jsonb) then
    new.page_access := public.default_page_levels(new.role);
  end if;
  if new.page_access is not null then
    if jsonb_typeof(new.page_access) <> 'object' then
      raise exception 'page_access must be an object' using errcode = '22023';
    end if;
    for k, v in select key, value #>> '{}' from jsonb_each(new.page_access) loop
      if not (k = any(public.access_pages())) then
        raise exception 'Unknown page in page_access: %', k using errcode = '22023';
      end if;
      if v is null or v not in ('editor','viewer','full','view','own','none') then
        raise exception 'Unknown level in page_access: % = %', k, v using errcode = '22023';
      end if;
    end loop;
  end if;
  return new;
end $$;
