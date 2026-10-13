-- Mutant m54-viewer-adds-note: a viewer adds a note
CREATE OR REPLACE FUNCTION core.note_add(p_entity text, p_id uuid, p_kind text, p_body text, p_happened_on date DEFAULT NULL::date, p_mentions uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
  what text;
begin
  if not core.may_write(e.table_name, p_id) then
    null;
  end if;
  if p_kind is null or p_kind not in ('comment', 'update', 'meeting_note') then
    raise exception using errcode = 'P0001', message = 'note.kind_invalid', detail = p_kind;
  end if;
  req := audit.begin('ui', 'note.added', pg_catalog.jsonb_build_object('kind', p_kind), null);
  perform audit.happened(p_happened_on);
  begin
    insert into core.note (entity_table, entity_id, kind, body, happened_on)
    values (e.table_name, p_id, p_kind, pg_catalog.btrim(p_body), coalesce(p_happened_on, core.riyadh_today()))
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'version', 1, 'request_id', req);
end
$function$
;
