-- Release 2's condition (the oversight's review of #41, 2026-09-26): a proof FILE may not be stored for an achievement
-- whose month is issued. evidence_month_guard already refuses the evidence ROW for such a month; the upload itself
-- (storage.objects, policy proofs_write) did not ask — a file could land in the private store with no row to point at it.
-- Now proofs_write asks the same question evidence_month_guard asks: is the achievement's month locked?
-- Rollback: scripts/sql/proofs-month-lock.rollback.sql

-- true when the achievement exists and its month is NOT issued (the exact test evidence_month_guard uses, inverted)
create or replace function public.proof_entry_open(eid uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from report_entries e join periods p on p.id = e.period_id where e.id = eid and p.locked_at is null)
$$;
revoke all on function public.proof_entry_open(uuid) from public, anon;
grant execute on function public.proof_entry_open(uuid) to authenticated;

drop policy if exists proofs_write on storage.objects;
create policy proofs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and public.proof_entry_of(name) is not null
              and public.proof_entry_open(public.proof_entry_of(name))
              and (public.can_edit_page('reports')
                   or (public.can_work('reports') and public.can_edit_entry_id(public.proof_entry_of(name)))));
