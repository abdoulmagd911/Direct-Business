-- Sabotage: an-idea-is-captured-as-a-plain-sticky
-- Breaks: sql:CAP-01
-- Expect: an idea is a private sticky marked as an idea
-- An idea is saved as a plain sticky, so it cannot be told from any other note (Stage 1).
create or replace function my.note_capture(p_kind text, p_values jsonb default null, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  -- 3. an idea is a sticky marked as one; a reminder is a sticky with its reminder set at capture (Stage 1)
  kind text := case when p_kind in ('idea', 'reminder') then 'sticky' else p_kind end;
  at timestamptz := nullif(v ->> 'remind_at', '')::timestamptz;
  nid uuid;
  req uuid;
  what text;
begin
  if p_kind = 'reminder' and (at is null or at <= core.clock()) then
    raise exception using errcode = 'P0001', message = 'reminder.time_required';
  end if;
  if p_kind <> 'reminder' and v ? 'remind_at' then
    raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = 'remind_at';
  end if;
  v := v - 'remind_at';
  perform my.note_fields_check(v);
  req := audit.begin('ui', 'note.captured', pg_catalog.jsonb_build_object('kind', p_kind));
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into my.note (person_id, kind, idea, title, body, items, visibility, happened_on, meeting_partner_id, meeting_on)
    values (me, kind, false, nullif(pg_catalog.btrim(v ->> 'title'), ''), nullif(pg_catalog.btrim(v ->> 'body'), ''),
            my.items_clean(v -> 'items'), coalesce(nullif(v ->> 'visibility', ''), 'private'),
            coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()),
            nullif(v ->> 'meeting_partner_id', '')::uuid, nullif(v ->> 'meeting_on', '')::date)
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = my.note_refused(what);
  end;
  perform my.mentions_set(nid, p_mentions);
  if p_kind = 'reminder' then
    insert into core.reminder (person_id, note_id, remind_at, text)
    values (me, nid, at, pg_catalog.left(coalesce(nullif(pg_catalog.btrim(v ->> 'title'), ''), pg_catalog.btrim(v ->> 'body')), 500));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req);
end
$$;
