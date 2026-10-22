-- Sabotage: recently-deleted-offers-restore-to-all
-- Breaks: sql:DEL-03
-- Expect: a viewer sees the removed achievement without Restore
-- Every row says it may be restored, so the screen offers Restore to a viewer (QA-576); the door itself is left as it is.
-- Since QA-585 the flag is "core.restore_refusal(...) is null" (z.refused), so that is what it overrides.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('core.recently_deleted(integer)'::regprocedure);
begin
  if pg_catalog.strpos(d, 'z.refused is null') = 0 then
    raise exception 'the Restore flag is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, 'z.refused is null', 'true');
end
$$;
