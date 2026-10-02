-- Turn into an achievement (V433, P5-4; builder E, after #139 and #148 — the Architect on #148, 1 Oct). A note on My
-- day becomes an achievement through perf.achievement_log, in the conversion's one request, linked both ways like the
-- other conversions (V184): the record shows "from note", the note "turned into". The request reads as the achievement
-- logged, so nobody learns of a note they may not see (V186). #139's migration is left as it is: its two functions are
-- replaced here whole, every other case unchanged — a task and an action item still answer note.turn_into_not_yet
-- until P5-1's own conversion lands, which keeps this case when it replaces them again.

create or replace function my.turn_into_inner(n my.note, p_kind text, p_values jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}'::jsonb);
  pid uuid;
  carried uuid[];
  left_out uuid[];
  a jsonb;
  rid uuid;
  at timestamptz;
  words text;
  what text;
  t text := coalesce(nullif(v ->> 'type', ''), case when n.kind = 'meeting' then 'meeting' else 'call' end);
begin
  if p_kind = 'activity' then
    if t not in ('call', 'meeting') then
      raise exception using errcode = 'P0001', message = 'note.turn_into_type_invalid', detail = t;
    end if;
    pid := coalesce(nullif(v ->> 'partner_id', '')::uuid, n.meeting_partner_id);
    if pid is null then
      raise exception using errcode = 'P0001', message = 'note.turn_into_needs_partner';
    end if;
    select pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where authz.can_see_as(m.person_id, 'partner.partner', pid) and core.person_available(m.person_id)),
           pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where not (authz.can_see_as(m.person_id, 'partner.partner', pid) and core.person_available(m.person_id)))
      into carried, left_out
    from my.note_mention m where m.note_id = n.id and m.deleted_at is null;
    a := partner.activity_log(pid, t, nullif(v ->> 'outcome', ''),
                              coalesce(nullif(v ->> 'happened_on', '')::date,
                                       case when t = 'meeting' then n.meeting_on end, n.happened_on),
                              coalesce(nullif(pg_catalog.btrim(v ->> 'body'), ''), my.note_text(n)),
                              nullif(v ->> 'next_step', ''), nullif(v ->> 'next_step_on', '')::date, carried);
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'core.note', (a ->> 'id')::uuid);
    return a || pg_catalog.jsonb_build_object('entity', 'activity', 'type', t, 'partner_id', pid,
                                              'mentions_left_out', coalesce(pg_catalog.to_jsonb(left_out), '[]'::jsonb));
  elsif p_kind = 'reminder' then
    at := nullif(v ->> 'remind_at', '')::timestamptz;
    if at is null then
      raise exception using errcode = 'P0001', message = 'reminder.time_required';
    end if;
    if at <= core.clock() then
      raise exception using errcode = 'P0001', message = 'reminder.time_passed';
    end if;
    words := coalesce(nullif(pg_catalog.btrim(v ->> 'text'), ''), pg_catalog.left(pg_catalog.btrim(my.note_text(n)), 500));
    begin
      insert into core.reminder (person_id, note_id, remind_at, text) values (me, n.id, at, words) returning id into rid;
    exception when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = my.note_refused(what);
    end;
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'core.reminder', rid);
    return pg_catalog.jsonb_build_object('id', rid, 'entity', 'reminder', 'remind_at', at);
  elsif p_kind = 'achievement' then
    -- V433, P5-4: the achievement through its own door — the person's own achievement rights, its category, its
    -- evidence rules, its number and an MoU's Prospect (V601) — dated by the note's day unless told; the note's mentions
    -- who may still be named carry over as its participants.
    select pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where core.person_available(m.person_id)),
           pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where not core.person_available(m.person_id))
      into carried, left_out
    from my.note_mention m where m.note_id = n.id and m.deleted_at is null;
    a := perf.achievement_log(
      (v - 'refs' - 'type')
      || pg_catalog.jsonb_build_object(
           'title', coalesce(nullif(pg_catalog.btrim(v ->> 'title'), ''), n.title,
                             pg_catalog.left(pg_catalog.btrim(my.note_text(n)), 300)),
           'notes', coalesce(nullif(pg_catalog.btrim(v ->> 'notes'), ''), nullif(pg_catalog.btrim(n.body), '')),
           'happened_on', case when v ? 'happened_on' then v -> 'happened_on' else pg_catalog.to_jsonb(n.happened_on) end,
           'partner_id', coalesce(v -> 'partner_id', pg_catalog.to_jsonb(n.meeting_partner_id))),
      v -> 'refs', carried);
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'perf.achievement', (a ->> 'id')::uuid);
    return a || pg_catalog.jsonb_build_object('entity', 'achievement',
                                              'mentions_left_out', coalesce(pg_catalog.to_jsonb(left_out), '[]'::jsonb));
  elsif p_kind in ('task', 'action_item') then
    raise exception using errcode = 'P0001', message = 'note.turn_into_not_yet', detail = p_kind;
  end if;
  raise exception using errcode = 'P0001', message = 'note.turn_into_invalid', detail = p_kind;
end
$$;

create or replace function my.note_turn_into(p_note uuid, p_kind text, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_note);
  req uuid;
  r jsonb;
begin
  req := audit.begin('ui', case p_kind when 'activity' then 'partner.activity_logged'
                                       when 'achievement' then 'achievement.logged' else 'reminder.set' end,
                     pg_catalog.jsonb_build_object('kind', p_kind));
  r := my.turn_into_inner(n, p_kind, p_values);
  perform audit.end();
  return r || pg_catalog.jsonb_build_object('note_id', p_note, 'request_id', req);
end
$$;
