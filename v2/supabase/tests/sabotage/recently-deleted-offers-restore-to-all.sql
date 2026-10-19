-- Sabotage: recently-deleted-offers-restore-to-all
-- Breaks: sql:DEL-03
-- Expect: a viewer sees the removed achievement without Restore
-- Every row says it may be restored, so the screen offers Restore to a viewer (QA-576); the door itself is left as it is.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('core.recently_deleted(integer)'::regprocedure);
begin
  d := pg_catalog.replace(d, 'core.may_restore($4, t.id, $3, t.deleted_by)', 'true');
  execute d;
end
$$;
