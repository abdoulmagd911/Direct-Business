-- Rollback for d7-owner-can-undo.sql: puts back the release-1 undo_change (owner rule removed).
do $u$ declare d text; begin
  d := pg_get_functiondef('public.undo_change(bigint)'::regprocedure);
  d := replace(d, $x$ is_owner boolean := false; bid uuid; tid uuid;$x$, '');
  d := regexp_replace(d, E'  /\\* D7 \\(2026-09-25\\): is the caller the OWNER.*?  elsif not public.can_edit_page\\(pg\\) then', '  if not public.can_edit_page(pg) then', 's');
  d := replace(d, $x$ and not is_owner then
    return 'You can undo your own changes, and changes others made to what you own; an admin or manager can undo anyone''s.';$x$,
                  $x$ then
    return 'You can undo your own changes; an admin or manager can undo anyone''s.';$x$);
  execute d;
  d := pg_get_functiondef('public.undo_change(bigint)'::regprocedure);
  if position('is_owner' in d) > 0 or position($x$You can undo your own changes; an admin or manager can undo anyone''s.$x$ in d) = 0 then
    raise exception 'rollback did not restore the release-1 undo_change';
  end if;
end $u$;
