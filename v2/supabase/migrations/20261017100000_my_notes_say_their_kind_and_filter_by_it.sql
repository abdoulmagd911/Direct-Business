-- Every captured item says what it is, and My notes can be filtered by it (the Architect's ruling V641, the owner's live
-- test of 17 Oct). Cause of the finding "a captured idea cannot be found afterwards": an idea is stored as a plain note
-- marked `idea`, a reminder as a plain note with a reminder, and nothing on the read side ever said so — My notes drew
-- both as an unnamed note, could not be narrowed to one kind, and the search finds people only. From here:
--   1. my.capture_kind(note): 'meeting', 'checklist', 'idea', 'reminder' (captured as a Reminder, whether still to come
--      or told) or 'note'. Every note row now carries it as `capture_kind`.
--   2. api.my_notes_by_kind(scope, kind, limit, offset): the notes of one kind in a scope, with their total and whether
--      there are more, read exactly as My notes reads them. Unlike the plain list, the Reminder kind includes a
--      captured reminder that is still to come, so a person can always find it there.
-- my.note_row is replaced whole (as 20261016190000 left it, plus `capture_kind`). Forward-only (V103).

create function my.capture_kind(n my.note) returns text
language sql stable security definer set search_path = ''
as $$
  select case
           when n.kind in ('meeting', 'checklist') then n.kind
           when n.idea then 'idea'
           when exists (select 1 from core.reminder r
                        where r.note_id = n.id and r.deleted_at is null
                          and not exists (select 1 from my.note_link l
                                          where l.entity_table = 'core.reminder' and l.entity_id = r.id)) then 'reminder'
           else 'note' end
$$;
comment on function my.capture_kind(my.note) is
  'What a note was captured as: meeting, checklist, idea, reminder or note (V641). A note turned into a reminder later stays what it was.';

create or replace function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'idea', n.idea, 'capture_kind', my.capture_kind(n), 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility,
    'happened_on', n.happened_on, 'logged_at', n.logged_at, 'author_id', n.person_id, 'mine', n.person_id = p_reader,
    'meeting_partner', (select pg_catalog.jsonb_build_object('id', p.id, 'number', p.number, 'trade_name_en',
                                  p.trade_name_en, 'trade_name_ar', p.trade_name_ar)
                        from partner.partner p
                        where p.id = n.meeting_partner_id and authz.can_see_as(p_reader, 'partner.partner', p.id)),
    'about', work.about_of(n.about_table, n.about_id, p_reader),
    'meeting_on', n.meeting_on, 'finished_at', n.finished_at,
    'carried_to', n.carried_to, 'done_at', n.done_at, 'version', n.version,
    'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                          from my.note_mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
    'links', my.turned_into(n.id, p_reader),
    'task_items', (select pg_catalog.jsonb_build_object(
                     'done', pg_catalog.count(*) filter (where ai.done_on is not null), 'total', pg_catalog.count(*))
                   from my.note_link l
                   join work.action_item ai on ai.id = l.entity_id and ai.deleted_at is null
                   where l.note_id = n.id and l.entity_table = 'work.action_item' and l.deleted_at is null
                     and authz.can_see_as(p_reader, 'work.task', ai.task_id)
                   having pg_catalog.count(*) > 0))
$$;

create function my.my_notes_by_kind(p_scope text, p_kind text, p_limit int default 7, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  scope text := coalesce(p_scope, 'me');
  lim int := greatest(1, least(coalesce(p_limit, 7), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
begin
  if scope not in ('me', 'team', 'workspace') then
    raise exception using errcode = 'P0001', message = 'my_day.scope_invalid', detail = scope;
  end if;
  if p_kind is null or p_kind not in ('note', 'idea', 'checklist', 'reminder', 'meeting') then
    raise exception using errcode = 'P0001', message = 'my_day.kind_invalid', detail = p_kind;
  end if;
  return pg_catalog.jsonb_build_object(
    'scope', scope, 'kind', p_kind,
    'notes', coalesce((
      select pg_catalog.jsonb_agg(my.note_row(y.n, me) order by y.d desc, y.at desc, y.id)
      from (select n as n, coalesce(n.carried_to, n.happened_on) as d, n.logged_at as at, n.id
            from my.note n where my.in_scope(n, scope, me) and my.capture_kind(n) = p_kind
            order by 2 desc, 3 desc, 4 limit lim offset off) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n
                    where my.in_scope(n, scope, me) and my.capture_kind(n) = p_kind),
    'more', exists (select 1 from my.note n
                    where my.in_scope(n, scope, me) and my.capture_kind(n) = p_kind offset off + lim));
end
$$;
comment on function my.my_notes_by_kind(text, text, int, int) is
  'The notes of one kind in a scope, as My day lists them (V641): note, idea, checklist, reminder or meeting.';
create function api.my_notes_by_kind(p_scope text, p_kind text, p_limit int default 7, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select my.my_notes_by_kind(p_scope, p_kind, p_limit, p_offset) $$;

grant execute on function my.my_notes_by_kind(text, text, int, int) to authenticated;
grant execute on function api.my_notes_by_kind(text, text, int, int) to authenticated;
