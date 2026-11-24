-- Sabotage: the-expense-keys-are-not-kept
-- Breaks: sql:CKY-01
-- Expect: three expense lines are kept by their keys
-- The keys of the expenses already counted are thrown away on every write, so nothing is known next time.
create function work.sabotage_forget_expense_keys() returns trigger language plpgsql set search_path = '' as $$
begin
  new.expense_keys := '{}';
  return new;
end
$$;
create trigger sabotage_forget_expense_keys before update on work.import_record
  for each row execute function work.sabotage_forget_expense_keys();
