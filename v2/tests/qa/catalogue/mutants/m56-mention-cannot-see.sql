-- Mutant m56-mention-cannot-see: a person who cannot see the record may be mentioned
CREATE OR REPLACE FUNCTION core.mentions_add(p_note uuid, p_people uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    if not authz.can_see_as(who, n.entity_table, n.entity_id) then
      null;
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who);
    perform notify.push(who, 'mentioned', n.entity_table, n.entity_id, 'notify.mentioned',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$function$
;
