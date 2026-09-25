-- what the LIVE database says on 2026-09-25 where the test stub (29e) differs — measured with pg_get_functiondef / pg_policy
create or replace function public.next_document_number(p_family text) returns text language plpgsql security definer set search_path to 'public' as $function$
declare y integer := extract(year from now())::integer; n integer;
begin
  if app_role() is null then raise exception 'not allowed'; end if;
  if not public.can_edit_page('documents') then
    raise exception 'Only someone with full control of the Generator can issue a document number.' using errcode = '42501';
  end if;
  insert into document_counters(family, year, last_n) values (upper(p_family), y, 1)
    on conflict (family, year) do update set last_n = document_counters.last_n + 1
    returning last_n into n;
  return upper(p_family) || '-' || y || '-' || lpad(n::text, 3, '0');
end $function$;
create or replace function public.default_page_levels(r public.user_role) returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end $$;
alter table record_history enable row level security;
create policy record_history_read on record_history for select to authenticated using (
  case when table_name = any (array['finance_invoices','finance_transactions','finance_client_links']) then can_see_page('finance') else true end);
-- live Phase 1b-E owner resolution, and the live Undo (copied from production 2026-09-25)
alter table app_users add column if not exists nickname_ar text;
create table if not exists owner_name_preference(name_key text primary key, user_id uuid not null references app_users(id) on delete cascade);
alter table owner_name_preference enable row level security;
create policy owner_name_preference_read on owner_name_preference for select to authenticated using (public.app_role() is not null);
create or replace function public.owner_candidates(nm text) returns setof uuid language sql stable security definer set search_path to 'public' as $function$
  select u.id from public.app_users u
   where coalesce(trim(nm),'') <> ''
     and lower(trim(nm)) in (lower(trim(coalesce(u.full_name,''))), lower(trim(coalesce(u.name_ar,''))),
                            lower(trim(coalesce(u.nickname,''))), lower(trim(coalesce(u.nickname_ar,''))),
                            lower(split_part(u.email,'@',1)))
$function$;
create or replace function public.resolve_owner(nm text) returns uuid language sql stable security definer set search_path to 'public' as $function$
  select coalesce(
    (select p.user_id from public.owner_name_preference p where p.name_key = lower(trim(nm))),
    (select case when count(*) = 1 then min(c::text)::uuid end from public.owner_candidates(nm) c))
$function$;
CREATE OR REPLACE FUNCTION public.undo_change(p_id bigint)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare h record; me uuid; my_role text; win interval := interval '24 hours'; cols text; pg text; pg_word text;
begin
  me := auth.uid();
  select role::text into my_role from app_users where id = me and active;
  if me is null or my_role is null then
    return 'You must be signed in with an active account to undo a change.';
  end if;
  select * into h from record_history where id = p_id;
  if h.id is null            then return 'That change is not in the log.'; end if;
  if h.undone_at is not null then return 'Already undone.'; end if;
  if now() - h.at > win      then return 'Too old to undo — this only works within 24 hours. Ask an admin to restore it.'; end if;
  if h.action = 'create'     then return 'Undoing a newly created record is not an undo — delete it instead, which is itself logged.'; end if;
  if h.before_row is null    then return 'Nothing to put back.'; end if;
  if h.table_name = 'businesses' then
    pg := case when coalesce((h.before_row->>'is_client')::boolean, false) then 'clients' else 'leads' end;
  elsif h.table_name in ('contacts','activities') then
    select case when b.is_client then 'clients' else 'leads' end into pg
      from businesses b where b.id::text = h.before_row->>'business_id';
    pg := coalesce(pg, 'leads');
  elsif h.table_name = 'client_profiles' then
    pg := 'clients';
  elsif h.table_name in ('finance_invoices','finance_transactions','finance_client_links') then
    pg := 'finance';
  else
    return 'This kind of change cannot be undone here.';
  end if;
  if not public.can_edit_page(pg) then
    pg_word := case pg when 'leads' then 'Leads' when 'clients' then 'Clients' when 'finance' then 'Finance' else pg end;
    return 'Undoing this needs full control of the ' || pg_word || ' page.';
  end if;
  if h.table_name in ('finance_invoices','finance_transactions') then
    if coalesce(my_role,'') not in ('admin','manager') then
      return 'Money records can only be undone by an admin or a manager.'; end if;
  elsif h.actor is distinct from me and coalesce(my_role,'') not in ('admin','manager') then
    return 'You can undo your own changes; an admin or manager can undo anyone''s.';
  end if;
  if h.action = 'delete' and h.after_row is null and coalesce(my_role,'') <> 'admin' then
    return 'Bringing back a fully deleted record is an admin action.'; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name=h.table_name
    and is_generated='NEVER' and is_identity='NO';
  if h.after_row is null then
    execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I, $1)',
                   h.table_name, cols, cols, h.table_name) using h.before_row;
  else
    execute format('update %I set (%s) = (select %s from jsonb_populate_record(null::%I, $1)) where id = $2',
                   h.table_name, cols, cols, h.table_name) using h.before_row, h.record_id;
  end if;
  update record_history set undone_at = now(), undone_by = me where id = p_id;
  return 'ok';
end$function$;
