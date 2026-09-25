-- Undo phase1b-c-undo-follows-the-page.sql: undo_change exactly as it was (read 2026-09-25).
create or replace function public.undo_change(p_id bigint)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare h record; me uuid; my_role text; win interval := interval '24 hours'; cols text;
begin
  me := auth.uid();
  select role::text into my_role from app_users where id = me and active;

  /* Hard gate. Must come before anything else: without it a caller with no account reached
     the permission checks below with my_role = null, and `null not in (...)` is null, which
     plpgsql evaluates as false -- so the checks passed silently. */
  if me is null or my_role is null then
    return 'You must be signed in with an active account to undo a change.';
  end if;

  select * into h from record_history where id = p_id;

  if h.id is null            then return 'That change is not in the log.'; end if;
  if h.undone_at is not null then return 'Already undone.'; end if;
  if now() - h.at > win      then return 'Too old to undo — this only works within 24 hours. Ask an admin to restore it.'; end if;
  if h.action = 'create'     then return 'Undoing a newly created record is not an undo — delete it instead, which is itself logged.'; end if;
  if h.before_row is null    then return 'Nothing to put back.'; end if;

  if h.table_name in ('finance_invoices','finance_transactions') then
    if coalesce(my_role,'') not in ('admin','manager') then
      return 'Money records can only be undone by an admin or a manager.'; end if;
  elsif h.actor is distinct from me and coalesce(my_role,'') not in ('admin','manager') then
    return 'You can undo your own changes; an admin or manager can undo anyone''s.';
  end if;
  if h.action = 'delete' and h.after_row is null and coalesce(my_role,'') <> 'admin' then
    return 'Bringing back a fully deleted record is an admin action.'; end if;

  /* Generated columns (finance_invoices derives month/quarter/year from the invoice date)
     and identity columns cannot be written to — the database recomputes them. Listing them
     made the first version of this fail with "column year can only be updated to DEFAULT".
     They are excluded here; being derived, they come back correct on their own. */
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
