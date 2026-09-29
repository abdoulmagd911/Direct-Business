-- Sabotage: a-mention-tells-nobody
-- Breaks: sql:NOTE-01
-- Expect: as a mention
-- A mention is recorded but its person is never told (the owners' change notice is all they get).
create or replace function core.mentions_add(p_note uuid, p_people uuid[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n core.note;
  who uuid;
  k int := 0;
begin
  select * into n from core.note where id = p_note;
  foreach who in array coalesce(p_people, '{}') loop
    if exists (select 1 from core.mention m where m.note_id = p_note and m.person_id = who) then
      continue;
    end if;
    if not exists (select 1 from core.person p where p.id = who and p.kind = 'staff' and p.active and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = who::text;
    end if;
    if not core.may_see(who, n.entity_table, n.entity_id) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see',
        detail = (select p.full_name_en from core.person p where p.id = who);
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who);
    k := k + 1;
  end loop;
  return k;
end
$$;
