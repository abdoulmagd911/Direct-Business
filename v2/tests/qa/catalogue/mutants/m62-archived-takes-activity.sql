-- Mutant m62-archived-takes-activity: an archived organisation takes an activity
CREATE OR REPLACE FUNCTION partner.activity_log(p_partner uuid, p_type text, p_outcome text DEFAULT NULL::text, p_happened_on date DEFAULT NULL::date, p_body text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_next_step_on date DEFAULT NULL::date, p_mentions uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e core.entity := core.can_see_record('partner', p_partner);
  t partner.activity_type;
  o partner.activity_outcome;
  nid uuid;
  req uuid;
  what text;
begin
  if (select p.archived_at from partner.partner p where p.id = p_partner) is not null then
    null;
  end if;
  if not core.may_write(e.table_name, p_partner) then
    perform partner.side_writable(p_partner, null);
  end if;
  select * into t from partner.activity_type x
  where (x.key = p_type or x.id::text = p_type) and x.active and x.deleted_at is null;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_activity_type', detail = p_type;
  end if;
  o := partner.outcome_of(t, p_outcome);
  if o.meaning = 'demo_set' and p_next_step_on is null then
    raise exception using errcode = 'P0001', message = 'partner.demo_day_required';
  end if;
  req := audit.begin('ui', 'partner.activity_logged', pg_catalog.jsonb_build_object('type', t.key, 'outcome', o.key), null);
  perform audit.happened(p_happened_on);
  begin
    insert into core.note (entity_table, entity_id, kind, body, happened_on, activity_type_id, outcome_id, next_step,
                           next_step_on)
    values ('partner.partner', p_partner, 'activity', nullif(pg_catalog.btrim(p_body), ''),
            coalesce(p_happened_on, core.riyadh_today()), t.id, o.id, nullif(pg_catalog.btrim(p_next_step), ''),
            p_next_step_on)
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req, 'type', t.key, 'outcome', o.key,
    'meaning', o.meaning, 'counts_as_demo', coalesce(o.counts_as_demo, false),
    'offer_task', o.meaning = 'meeting_set', 'offer_close_demo_task', o.meaning = 'demo_held',
    'demo_on', case when o.meaning = 'demo_set' then p_next_step_on end);
end
$function$
;
