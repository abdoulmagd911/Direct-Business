-- A checklist note's card on My day counts its task's items (the Architect's ruling of 16 Oct): a checklist turned into a
-- task becomes that task's action items (V286), and closing them on the task never touched the note's own rows, so the
-- card kept saying 1/2 after both were done. Every note now also says `task_items`: how many of the action items made
-- from it (the ones its links name) are done, out of how many, counting only those on a task the reader may see — absent when the note made none,
-- so the card then counts its own rows as before. my.note_row is replaced whole; nothing else changes. Forward-only (V103).

create or replace function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'idea', n.idea, 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility,
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
