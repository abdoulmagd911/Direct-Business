-- Phase 1a — one access check, four levels (D2, docs/DECISIONS.md). 2026-09-25.
--
-- Additive and safe for the app that is live while this lands: the stored words stay
-- 'editor' / 'viewer' until the rename step (phase1a-rename-levels.sql) runs AFTER the 1a pull
-- request is merged. Until then page_level() reads both vocabularies.
--
-- Levels: none < view < own < full. Admins are always full and sit outside the grid.
-- 'own' opens a page but writes nothing through the old page checks: each page learns who owns
-- what in 1b, and the Team & Access screen offers 'own' on a page only once it has.
-- Rollback: phase1a-access-levels-rollback.sql.

-- the one list of pages the grid covers (the screen reads the same list through my_page_levels)
create or replace function public.access_pages()
returns text[] language sql immutable set search_path to 'public' as $$
  select array['today','leads','clients','offers','documents','ops','reports','finance','settings',
               'events','airlines','vendors','sopsla','activity','archive',
               'projects','bookings','invoices','tickets','sync']
$$;

-- one word per level, whichever vocabulary it was stored in
create or replace function public.level_word(v text)
returns text language sql immutable set search_path to 'public' as $$
  select case v when 'full' then 'full' when 'editor' then 'full'
                when 'own' then 'own'
                when 'view' then 'view' when 'viewer' then 'view'
                else 'none' end
$$;

create or replace function public.level_rank(v text)
returns int language sql immutable set search_path to 'public' as $$
  select case public.level_word(v) when 'full' then 3 when 'own' then 2 when 'view' then 1 else 0 end
$$;

-- the starting grid a role gets — matches what each role can do today (seed from today)
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;

-- THE check. Every other access question in the database is answered through this.
create or replace function public.page_level(p text)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when p is null or not (p = any(public.access_pages())) then 'none'
    when public.app_role() is null then 'none'
    when public.app_role() = 'admin' then 'full'
    else (select case when public.level_word(u.page_access->>p) = 'none' and p = 'today' then 'view'
                      else public.level_word(u.page_access->>p) end
            from public.app_users u where u.id = auth.uid() and u.active)
  end
$$;

-- the screen's one source: every page and this person's level on it
create or replace function public.my_page_levels()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when public.app_role() is null then null
              else (select jsonb_object_agg(p, public.page_level(p)) from unnest(public.access_pages()) p) end
$$;

-- the one way to change someone's grid from the app
create or replace function public.set_page_levels(target uuid, levels jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me public.user_role := public.app_role();
  t public.app_users%rowtype;
  k text; v text; clean jsonb := '{}'::jsonb; old_v text;
begin
  if me is null or me not in ('admin','manager') then
    raise exception 'Only an admin or a manager can change access.' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot change your own access.' using errcode = '42501';
  end if;
  select * into t from public.app_users where id = target;
  if not found then raise exception 'No such team account.' using errcode = 'P0002'; end if;
  if t.role = 'admin' then
    raise exception 'Admins have full access to every page. Change their level first.' using errcode = '42501';
  end if;
  if levels is null or jsonb_typeof(levels) <> 'object' then
    raise exception 'Access must be a list of pages and levels.' using errcode = '22023';
  end if;
  for k, v in select key, value #>> '{}' from jsonb_each(levels) loop
    if not (k = any(public.access_pages())) then
      raise exception 'Unknown page: %', k using errcode = '22023';
    end if;
    if v is null or v not in ('none','view','own','full') then
      raise exception 'Unknown level "%" on %', v, k using errcode = '22023';
    end if;
    old_v := public.level_word(t.page_access->>k);
    -- a manager may raise someone only up to the manager's own level on that page
    if me = 'manager' and public.level_rank(v) > public.level_rank(old_v)
       and public.level_rank(v) > public.level_rank(public.page_level(k)) then
      raise exception 'You can only give access up to your own level on %.', k using errcode = '42501';
    end if;
    if v <> 'none' then clean := clean || jsonb_build_object(k, v); end if;
  end loop;
  -- pages left out of the request keep what they had
  for k in select key from jsonb_each(coalesce(t.page_access,'{}'::jsonb)) loop
    if not levels ? k and public.level_word(t.page_access->>k) <> 'none' then
      clean := clean || jsonb_build_object(k, public.level_word(t.page_access->>k));
    end if;
  end loop;
  update public.app_users set page_access = clean where id = target;
  insert into public.record_history(actor, actor_name, table_name, record_id, action, before_row, after_row)
  values (auth.uid(),
          (select coalesce(nullif(full_name,''), email) from public.app_users where id = auth.uid()),
          'access', target, 'levels_changed',
          jsonb_build_object('target_email', t.email, 'target_name', t.full_name, 'levels', coalesce(t.page_access,'{}'::jsonb)),
          jsonb_build_object('target_email', t.email, 'target_name', t.full_name, 'levels', clean));
  return clean;
end $$;

-- the three older checks keep their names (every existing rule calls them) and now ask page_level
create or replace function public.page_access(p text)
returns text language sql stable security definer set search_path to 'public' as $$
  select case public.page_level(p) when 'full' then 'editor' when 'own' then 'own'
                                   when 'view' then 'viewer' else null end
$$;
create or replace function public.can_see_page(p text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.page_level(p) <> 'none'
$$;
create or replace function public.can_edit_page(p text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.page_level(p) = 'full'
$$;

-- nothing but known pages and known level words may ever be stored; and a non-admin with no grid
-- gets their role's starting grid (new people used to get none, which the database read as
-- "no access to anything" while the screen fell back to its own lists)
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
drop trigger if exists trg_app_users_page_access_guard on public.app_users;
create trigger trg_app_users_page_access_guard
  before insert or update of page_access, role on public.app_users
  for each row execute function public.app_users_page_access_guard();

-- page_level/page_access/can_* are called by row-level rules, which also run for signed-out
-- requests — they must stay executable by anon (migration 20260822151107 learned this).
-- The setter and the screen's lookup are for signed-in people only.
revoke all on function public.set_page_levels(uuid, jsonb) from public, anon;
grant execute on function public.set_page_levels(uuid, jsonb) to authenticated;
revoke all on function public.my_page_levels() from public, anon;
grant execute on function public.my_page_levels() to authenticated;

-- part 2 (same day): the Team & Access editor's list. Admins and managers only; everybody's level
-- on every page, already in the four words (the screen never translates stored words itself).
create or replace function public.team_access_list()
returns table(id uuid, full_name text, email text, role public.user_role, active boolean, levels jsonb)
language sql stable security definer set search_path to 'public' as $$
  select u.id, u.full_name, u.email, u.role, u.active,
         case when u.role = 'admin' then null
              else (select jsonb_object_agg(p, case when public.level_word(u.page_access->>p) = 'none' and p = 'today'
                                                    then 'view' else public.level_word(u.page_access->>p) end)
                      from unnest(public.access_pages()) p) end
    from public.app_users u
   where public.app_role() in ('admin','manager')
   order by case u.role when 'admin' then 0 when 'manager' then 1 else 2 end, lower(coalesce(nullif(u.full_name,''), u.email))
$$;
revoke all on function public.team_access_list() from public, anon;
grant execute on function public.team_access_list() to authenticated;
