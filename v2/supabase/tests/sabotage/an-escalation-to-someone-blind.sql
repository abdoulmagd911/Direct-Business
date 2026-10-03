-- Sabotage: an-escalation-to-someone-blind
-- Breaks: sql:ESC-01
-- Expect: never to someone who cannot see it
-- A record is escalated to a person who cannot open it.
create or replace function core.escalate(p_entity text, p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  nid uuid;
  req uuid;
begin
  if e.table_name not in ('work.task', 'partner.partner') then
    raise exception using errcode = 'P0001', message = 'escalation.not_here', detail = p_entity;
  end if;
  if not core.may_write(e.table_name, p_id) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', e.page_key, 'level', 'own')::text;
  end if;
  if nullif(pg_catalog.btrim(p_note), '') is null then
    raise exception using errcode = 'P0001', message = 'escalation.note_required';
  end if;
  if p_to is null or not work.person_ok(p_to) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_to::text;
  end if;
  if p_to = authz.me() then
    raise exception using errcode = 'P0001', message = 'escalation.to_yourself';
  end if;
  if false then
    raise exception using errcode = 'P0001', message = 'escalation.cannot_see', detail = p_to::text;
  end if;
  req := audit.begin('ui', 'escalation.raised', pg_catalog.jsonb_build_object('entity', e.key));
  insert into core.note (entity_table, entity_id, kind, body) values (e.table_name, p_id, 'escalation', pg_catalog.btrim(p_note))
  returning id into nid;
  insert into notify.follow (person_id, entity_table, entity_id) values (p_to, e.table_name, p_id) on conflict do nothing;
  perform notify.push_assigned(p_to, 'escalated', e.table_name, p_id, pg_catalog.jsonb_build_object('note_id', nid));
  perform audit.end();
  return pg_catalog.jsonb_build_object('note_id', nid, 'request_id', req);
end
$$;
