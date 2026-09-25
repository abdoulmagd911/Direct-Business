-- D7, owner's ruling (2026-09-25): the OWNER of a task, or of the company a change belongs to, can undo
-- changes other people made to it — same 24-hour window, the undo recorded in history like any other.
-- Before: an ordinary employee could undo only their own changes; admins and managers anyone's.
-- Unchanged: money records (admin / manager only), bringing back a fully deleted record (admin only),
-- a third colleague (their own changes only), and the page-level gate for everyone who is not the owner.
-- The owner needs Own work or Full control on the record's page (the page they own the record on).
-- Who owns what is the database's own answer: tasks.owner_id / projects.owner_id (the team member) and
-- businesses.owner_id (the account, Phase 1b-E); a contact, activity or client profile follows its company,
-- a checklist step, update, file, person or tag follows its task.
-- Applies only where each of the three pieces it changes appears exactly once (the live release-1 version,
-- md5 1239b36ac82dfbc09b120295bb6b519c on 2026-09-25, qualifies); otherwise it stops and changes nothing.
-- Rollback: d7-owner-can-undo-rollback.sql.
do $u$ declare d text; begin
  d := pg_get_functiondef('public.undo_change(bigint)'::regprocedure);
  if (length(d) - length(replace(d, $x$declare h record; me uuid; my_role text; win interval := interval '24 hours'; cols text; pg text; pg_word text;$x$, ''))) = 0
     or (length(d) - length(replace(d, $x$  if not public.can_edit_page(pg) then$x$, ''))) <> length($x$  if not public.can_edit_page(pg) then$x$)
     or position($x$  elsif h.actor is distinct from me and coalesce(my_role,'') not in ('admin','manager') then
    return 'You can undo your own changes; an admin or manager can undo anyone''s.';$x$ in d) = 0
     or position('is_owner' in d) > 0 then
    raise exception 'undo_change is not the version this change was written against — stop and re-read it';
  end if;
  d := replace(d, $x$declare h record; me uuid; my_role text; win interval := interval '24 hours'; cols text; pg text; pg_word text;$x$,
                  $x$declare h record; me uuid; my_role text; win interval := interval '24 hours'; cols text; pg text; pg_word text; is_owner boolean := false; bid uuid; tid uuid;$x$);
  d := replace(d, $x$  if not public.can_edit_page(pg) then$x$,
$x$  /* D7 (2026-09-25): is the caller the OWNER of the record this change belongs to? */
  if h.table_name = 'businesses' then bid := h.record_id;
  elsif h.table_name in ('contacts','activities','client_profiles') then
    bid := coalesce(nullif(h.before_row->>'business_id','')::uuid, nullif(h.after_row->>'business_id','')::uuid);
  elsif h.table_name = 'tasks' then tid := h.record_id;
  elsif h.table_name in ('task_people','task_checklist','task_comments','task_files','task_dependencies','task_tags') then
    tid := coalesce(nullif(h.before_row->>'task_id','')::uuid, nullif(h.after_row->>'task_id','')::uuid);
  end if;
  if bid is not null then
    is_owner := exists (select 1 from businesses b where b.id = bid and b.owner_id = me);
  elsif tid is not null then
    is_owner := exists (select 1 from tasks t join team_members tm on tm.id = t.owner_id where t.id = tid and tm.user_id = me and tm.active);
  elsif h.table_name = 'projects' then
    is_owner := exists (select 1 from projects p join team_members tm on tm.id = p.owner_id where p.id = h.record_id and tm.user_id = me and tm.active);
  end if;
  if is_owner and public.page_level(pg) in ('own','full') then
    null;   -- the owner, working on their own record's page: the gate below does not apply
  elsif not public.can_edit_page(pg) then$x$);
  d := replace(d, $x$  elsif h.actor is distinct from me and coalesce(my_role,'') not in ('admin','manager') then
    return 'You can undo your own changes; an admin or manager can undo anyone''s.';$x$,
$x$  elsif h.actor is distinct from me and coalesce(my_role,'') not in ('admin','manager') and not is_owner then
    return 'You can undo your own changes, and changes others made to what you own; an admin or manager can undo anyone''s.';$x$);
  if position('is_owner and public.page_level' in d) = 0 or position('and not is_owner then' in d) = 0 then
    raise exception 'undo_change did not take the owner rule';
  end if;
  execute d;
end $u$;
