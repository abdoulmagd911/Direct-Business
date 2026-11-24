-- Sabotage: a-re-import-rewrites-the-typed-row
-- Breaks: sql:DPN-01
-- Expect: the typed row is untouched by the import
-- An imported row overwrites the total of the hand-typed invoice that carries the same number.
create function work.sabotage_overwrite_typed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update finance.invoice set total_sar = new.amount_sar where ref = new.transaction_ref and deleted_at is null;
  return new;
end
$$;
create trigger sabotage_overwrite_typed after insert on work.import_record
  for each row execute function work.sabotage_overwrite_typed();
