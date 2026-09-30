-- Sabotage: a-from-note-chip-shows-a-private-note
-- Breaks: sql:NOTE-03
-- Expect: someone who cannot see the note sees the call without its chip
-- A record shows the note it came from to everyone, the note's own rule unasked (V454).
create or replace function my.from_notes(p_table text, p_id uuid, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'note_id', n.id, 'kind', n.kind, 'title', n.title, 'author_id', n.person_id, 'made_at', l.created_at)
           order by l.created_at, l.id), '[]'::jsonb)
  from my.note_link l join my.note n on n.id = l.note_id
  where l.entity_table = p_table and l.entity_id = p_id and l.deleted_at is null and n.deleted_at is null
    and core.record_live(p_table, p_id)
$$;
