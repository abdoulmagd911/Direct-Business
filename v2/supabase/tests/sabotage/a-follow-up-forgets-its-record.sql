-- Sabotage: a-follow-up-forgets-its-record
-- Breaks: sql:FUP-01
-- Expect: the note says what it is about
-- A follow-up note is saved without its record, so neither the note nor its reminder can say what it is about (V632 Stage 2).
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
  ab jsonb := v -> 'about';
  ab_table text;
  ab_id uuid;
  req uuid;
  what text;
begin
  if p_kind = 'reminder' and (at is null or at <= core.clock()) then
    raise exception using errcode = 'P0001', message = 'reminder.time_required';
  end if;
  if p_kind <> 'reminder' and v ? 'remind_at' then
    raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = 'remind_at';
  end if;
  v := v - 'remind_at' - 'about';
  -- a follow-up: what the note is about, a record its author may see (V454)
  if ab is not null and ab <> 'null'::jsonb then
    ab_table := case ab ->> 'entity' when 'partner' then 'partner.partner' when 'task' then 'work.task'
                                      when 'invoice' then 'finance.invoice' end;
    if ab_table is null then
      raise exception using errcode = 'P0001', message = 'note.about_invalid', detail = ab ->> 'entity';
    end if;
    ab_id := nullif(ab ->> 'id', '')::uuid;
    if ab_id is null or not authz.can_see_as(me, ab_table, ab_id) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = ab_table;
    end if;
  end if;
  perform my.note_fields_check(v);
  req := audit.begin('ui', 'note.captured', pg_catalog.jsonb_build_object('kind', p_kind));
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into my.note (person_id, kind, idea, title, body, items, visibility, happened_on, meeting_partner_id, meeting_on,
                         about_table, about_id)
    values (me, kind, p_kind = 'idea', nullif(pg_catalog.btrim(v ->> 'title'), ''), nullif(pg_catalog.btrim(v ->> 'body'), ''),
            my.items_clean(v -> 'items'), coalesce(nullif(v ->> 'visibility', ''), 'private'),
            coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()),
            nullif(v ->> 'meeting_partner_id', '')::uuid, nullif(v ->> 'meeting_on', '')::date, null, null)
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
