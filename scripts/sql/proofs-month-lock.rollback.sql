-- Rollback of scripts/sql/proofs-month-lock.sql: proofs_write goes back to release 2's rule (no month question).
drop policy if exists proofs_write on storage.objects;
create policy proofs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and public.proof_entry_of(name) is not null
              and (public.can_edit_page('reports')
                   or (public.can_work('reports') and public.can_edit_entry_id(public.proof_entry_of(name)))));
drop function if exists public.proof_entry_open(uuid);
