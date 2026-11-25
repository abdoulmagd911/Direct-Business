-- Sabotage: importing-needs-no-level-on-finance
-- Breaks: sql:XTR-05
-- Expect: Allowed with Finance at View cannot import through the older door
-- The one rule every import door asks forgets Finance at Full: a person set to Allowed who only reads Finance
-- imports.
create or replace function work.import_require() returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.require_capability('finance.import');
begin
  if not core.extra_access(me, 'finance.import') then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', 'finance.import')::text;
  end if;
end
$$;
