-- Sabotage: a-note-reveals-its-record
-- Breaks: sql:PRIV-02
-- Expect: but a teammate who cannot see the invoice reads nothing of it
-- A shared note shows its record as its author sees it, so a teammate who may not see the record reads it (V454).
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
    'about', work.about_of(n.about_table, n.about_id, n.person_id),
    'meeting_on', n.meeting_on, 'finished_at', n.finished_at,
    'carried_to', n.carried_to, 'done_at', n.done_at, 'version', n.version,
    'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                          from my.note_mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
    'links', my.turned_into(n.id, p_reader))
$$;
