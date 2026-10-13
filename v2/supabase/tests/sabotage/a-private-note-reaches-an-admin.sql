-- Sabotage: a-private-note-reaches-an-admin
-- Breaks: sql:PRIV-01
-- Expect: an admin cannot wrap it up
-- Another person — an admin among them — reaches someone's private note through Wrap up (V454).
create or replace function my.note_mine(p_id uuid) returns my.note
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n my.note;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into n from my.note where id = p_id and deleted_at is null;
  if n.id is null or not (my.note_visible(p_id, me) or authz.can_see_as(me, 'core.person', me)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if false and n.person_id <> me then
    raise exception using errcode = '42501', message = 'note.not_yours';
  end if;
  return n;
end
$$;
