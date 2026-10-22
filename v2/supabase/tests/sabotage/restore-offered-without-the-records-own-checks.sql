-- Sabotage: restore-offered-without-the-records-own-checks
-- Breaks: sql:DEL-04
-- Expect: the member sees the removed owner without Restore, and why
-- Recently deleted offers Restore by core.may_restore alone again (QA-585): a removed Side owner shows Restore to its
-- member, who lacks the side's Assign, and to a head, though the new owner holds the same days.
do $$
declare
  d text := pg_catalog.pg_get_functiondef('core.recently_deleted(int)'::regprocedure);
  rule text := 'z.refused is null';
begin
  if pg_catalog.strpos(d, rule) = 0 then
    raise exception 'the Restore flag is not where this sabotage expects it';
  end if;
  execute pg_catalog.replace(d, rule, 'core.may_restore($4, t.id, $3, t.deleted_by)');
end
$$;
