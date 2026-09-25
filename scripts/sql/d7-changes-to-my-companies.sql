-- D7 — "the owner is told". 2026-09-25. Applied live the same day.
--
-- The owner's ruling (docs/DECISIONS.md D7, "helpers, not locks"): everyone on the team may change any
-- company; the owner stays responsible, every change is recorded, it can be undone, and THE OWNER IS
-- TOLD. This function is the telling: the changes somebody ELSE made, in the last p_days (1..60, default
-- 7), to companies whose owner account (businesses.owner_id, Phase 1b-E) is the caller — the company
-- itself, its contacts and its client profile. Newest first, at most 50.
-- It runs as the caller (security invoker), so it can never show a row the caller could not read anyway.
-- Drawn on Today by js/106-changes-to-your-companies.js.
-- Verified in a discarded transaction before applying: the owner saw the helper's change (1 row), the
-- helper saw nothing (it was their own change), an anonymous caller was refused (42501).
-- Rollback: drop function public.changes_to_my_companies(int);

create or replace function public.changes_to_my_companies(p_days int default 7)
returns table(history_id bigint, at timestamptz, actor_name text, table_name text, action text,
              business_id uuid, business_name text, is_client boolean, before_row jsonb, after_row jsonb)
language sql stable security invoker set search_path to 'public' as $function$
  with h as (
    select h.*,
           case when h.table_name = 'businesses' then h.record_id
                else coalesce(nullif(h.after_row->>'business_id','')::uuid, nullif(h.before_row->>'business_id','')::uuid) end as bid
      from record_history h
     where h.table_name in ('businesses','contacts','client_profiles')
       and h.at > now() - make_interval(days => greatest(1, least(coalesce(p_days,7), 60)))
       and h.actor is not null
       and h.actor is distinct from auth.uid()
  )
  select h.id, h.at, h.actor_name, h.table_name, h.action, b.id, b.name, b.is_client, h.before_row, h.after_row
    from h join businesses b on b.id = h.bid
   where auth.uid() is not null and b.owner_id = auth.uid()
   order by h.at desc
   limit 50
$function$;
revoke all on function public.changes_to_my_companies(int) from public, anon;
grant execute on function public.changes_to_my_companies(int) to authenticated;
