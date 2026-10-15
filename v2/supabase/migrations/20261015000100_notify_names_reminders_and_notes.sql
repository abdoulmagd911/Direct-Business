-- A reminder in the bell read "Reminder: Reminder" (the supervisor's production sweep of 15 Oct, item 2): the bell
-- names a record through notify.entity_title, which had no case for a reminder or a note, so the row fell back to the
-- kind's word. Ruling: a reminder alert shows its note's title, or the note's first line when it has no title, never
-- "Reminder" alone; a reminder with no note shows its own first line. A note (a mention) reads the same way. Both stay
-- under the current-access check already at the top (a reminder and a private note are their person's alone).
-- Forward-only.

-- The first line of a text that holds words, trimmed and cut to 80 characters; null when there is none.
create function notify.first_line(p text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select pg_catalog.left(pg_catalog.btrim(l.line, E' \t\r'), 80)
  from pg_catalog.regexp_split_to_table(p, E'\n') with ordinality as l(line, n)
  where pg_catalog.btrim(l.line, E' \t\r') <> ''
  order by l.n
  limit 1
$$;

create or replace function notify.entity_title(p_table text, p_id uuid, p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  en text;
  ar text;
begin
  if p_table is null or p_id is null or not authz.can_see_as(p_person, p_table, p_id) then
    return pg_catalog.jsonb_build_object('title', null, 'title_ar', null);
  end if;
  case p_table
    when 'work.task' then
      select t.number || ' · ' || t.title into en from work.task t where t.id = p_id and t.deleted_at is null;
    when 'work.project' then
      select p.number || ' · ' || p.name into en from work.project p where p.id = p_id and p.deleted_at is null;
    when 'pipeline.opportunity' then
      select o.number || ' · ' || o.title into en from pipeline.opportunity o where o.id = p_id and o.deleted_at is null;
    when 'pipeline.tender' then
      select t.number || ' · ' || t.title into en from pipeline.tender t where t.id = p_id and t.deleted_at is null;
    when 'partner.partner' then
      select p.trade_name_en, coalesce(p.trade_name_ar, p.trade_name_en) into en, ar
      from partner.partner p where p.id = p_id and p.deleted_at is null;
    when 'core.reminder' then
      -- the note it reminds of by its title, else that note's first line, else the reminder's own first line
      select coalesce(n.title, notify.first_line(n.body), notify.first_line(r.text)) into en
      from core.reminder r left join my.note n on n.id = r.note_id and n.deleted_at is null
      where r.id = p_id and r.deleted_at is null;
    when 'my.note' then
      select coalesce(n.title, notify.first_line(n.body)) into en from my.note n where n.id = p_id and n.deleted_at is null;
    when 'core.person' then
      select coalesce(pr.display_name_en, x.nickname_en, x.full_name_en),
             coalesce(pr.display_name_ar, x.nickname_ar, x.full_name_ar, pr.display_name_en, x.nickname_en, x.full_name_en)
        into en, ar
      from core.person x left join core.person_profile pr on pr.person_id = x.id
      where x.id = p_id;
    else
      null;
  end case;
  return pg_catalog.jsonb_build_object('title', en, 'title_ar', coalesce(ar, en));
end
$$;

revoke all on function notify.first_line(text) from public;
