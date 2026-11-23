-- Sabotage: the-import-doors-ask-for-no-extra
-- Breaks: sql:XTR-01
-- Expect: a team member without the extra cannot start an import
-- The check the import doors make lets everyone through, so anyone with Finance at Full imports again — as before
-- Landing 40, when importing was not yet a specific extra.
create or replace function work.import_require() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  return;
end
$$;
