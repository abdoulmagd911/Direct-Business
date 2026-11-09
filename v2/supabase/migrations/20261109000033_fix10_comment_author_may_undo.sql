-- FIX-10 (F056, D22) — comment-delete Undo restores for the comment's author, whoever removed it.
-- Base: the latest audit.undo_allowed, 20261012080600, copied verbatim except for the owners branch, which is
-- generalised for comments. (An earlier draft of this migration copied an older body and lost the QA-211 rule-only
-- check, the QA-539 finance-tender carve-out and the reworked My-profile branch; the full suite caught it.)
-- The gap: a comment-remove touches only core.comment, whose entity row has page null and level core.comment_level —
-- so the owners branch's "(page null and level null)" disjunct never fires for a comment, and record_level on a
-- comment sitting on a page-less record (a note) returns 'none' — nobody but an admin could ever undo a comment
-- remove on a note (the live F056: the manager's own comments on a note, removed by an admin, refused on Undo).
-- And core.owners_of('core.comment', id) finds nobody (20261107130000), so the author failed the owner arm too.
-- The owners branch now reads the page and level from the comment's RECORD (its entity_table's entity row) and
-- counts the comment's author (created_by) as its owner — so the author still needs at least Own on the page the
-- comment sits on, and a comment on a note (page-less, level-less) needs the author alone. Every other record type
-- reads exactly as the latest version reads it (the comment joins are null for them).
create or replace function audit.undo_allowed(q audit.request, me uuid) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  window_h int := coalesce((core.setting_at('audit.undo_window_hours', null, core.riyadh_today()) #>> '{}')::int, 24);
begin
  -- A rule-only record (a private My day note, V454) is undone only by someone its own rule lets see every row the
  -- request touched — admins included, ahead of their shortcut (QA-211).
  if exists (select 1 from audit.change c
             join core.entity e on e.table_name = c.table_name and e.active and e.rule_only
             where c.request_id = q.id and not authz.can_see_as(me, c.table_name, c.row_id)) then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  if audit.touches_access(q.id) then
    return false;
  end if;
  -- My profile (V9, V97): a change you made to your own names or your own profile is yours to undo within the window,
  -- whatever your level on the people pages — exactly what api.profile_update let you change.
  if q.actor_id = me and q.at > core.clock() - pg_catalog.make_interval(hours => window_h)
     and not exists (
       select 1 from audit.change c
       where c.request_id = q.id
         and not ((c.table_name = 'core.person' and c.row_id = me
                   and c.fields <@ array['full_name_en', 'full_name_ar', 'nickname_en', 'nickname_ar'])
                  or (c.table_name = 'core.person_profile'
                      and exists (select 1 from core.person_profile pp where pp.id = c.row_id and pp.person_id = me)))) then
    return true;
  end if;
  if exists (select 1 from audit.change c where c.request_id = q.id and not authz.can_see_as(me, c.table_name, c.row_id)) then
    return false;
  end if;
  -- a tender's client ID is named on Finance with Full on Finance (V614), so its undo is judged there too, not on the
  -- tender's Pipeline page (QA-539)
  if authz.level_of(me, 'finance') = 'full'
     and not exists (select 1 from audit.change c where c.request_id = q.id
                     and not (c.table_name = 'pipeline.tender' and c.fields <@ array['client_identifier_id'])) then
    return true;
  end if;
  if not exists (select 1 from audit.change c
                 left join core.entity e on e.table_name = c.table_name and e.active
                 where c.request_id = q.id
                   and (e.id is null or authz.record_level(me, c.table_name, c.row_id) < 'full')) then
    return true;
  end if;
  if q.at <= core.clock() - pg_catalog.make_interval(hours => window_h) then
    return false;
  end if;
  -- an owner of every record it changed, with at least Own on each one's page. For a comment the "record" is the
  -- record the comment sits on (its entity_table), and the comment's author counts as its owner.
  return not exists (
    select 1 from audit.change c
    left join core.entity e on e.table_name = c.table_name and e.active
    left join core.comment cc on c.table_name = 'core.comment' and cc.id = c.row_id
    left join core.entity er on cc.entity_table = er.table_name and er.active
    where c.request_id = q.id
      and ((c.table_name <> 'core.comment' and e.id is null)
           or (c.table_name = 'core.comment' and er.id is null)
           or not (((c.table_name = 'core.comment' and er.page_key is null and er.level is null)
                    or (c.table_name <> 'core.comment' and e.page_key is null and e.level is null))
                   or authz.record_level(me, c.table_name, c.row_id) >= 'own')
           or (q.actor_id is distinct from me and not (me = any (core.owners_of(c.table_name, c.row_id))
                                                        or (cc.id is not null and me = cc.created_by)))));
end
$$;
