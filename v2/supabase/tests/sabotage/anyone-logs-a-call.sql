-- Sabotage: anyone-logs-a-call
-- Breaks: sql:CALL-01
-- Expect: a viewer logs no call
-- Log call asks nothing of the caller beyond seeing the partner.
create or replace function partner.log_call(p_partner uuid, p_outcome text, p_note text default null, p_occurred_on date default null,
                                 p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record('partner', p_partner);
  o partner.call_outcome;
  nid uuid;
  req uuid;
begin
  if (select p.archived_at from partner.partner p where p.id = p_partner) is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  select * into o from partner.call_outcome x where x.key = p_outcome and x.active;
  if o.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_outcome', detail = p_outcome;
  end if;
  if p_occurred_on > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'note.date_in_future';
  end if;
  req := audit.begin('ui', 'partner.call_logged', pg_catalog.jsonb_build_object('outcome', o.key), null);
  insert into core.note (entity_table, entity_id, kind, body, occurred_on, outcome_id)
  values ('partner.partner', p_partner, 'call', nullif(pg_catalog.btrim(p_note), ''),
          coalesce(p_occurred_on, core.riyadh_today()), o.id)
  returning id into nid;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req, 'outcome', o.key, 'counts_as_demo', o.counts_as_demo,
                                       'offer_task', o.key = 'meeting_set');
end
$$;
