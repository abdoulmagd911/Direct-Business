-- Sabotage: last-write-wins
-- Breaks: sql:CONC-01
-- Expect: a stale version is refused when someone changed the same field since
-- The version check reads the version and then lets any write through: the last write wins, silently (A14).
create or replace function core.check_version(p_table text, p_id uuid, p_expected int, p_fields text[]) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  cur int;
  hit record;
begin
  if p_expected is null then
    raise exception using errcode = 'P0001', message = 'common.version_required';
  end if;
  execute pg_catalog.format('select t.version from %s t where t.id = $1', pg_catalog.to_regclass(p_table))
    into cur using p_id;
  if cur is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return; -- the sabotage: the last write wins
end
$$;
