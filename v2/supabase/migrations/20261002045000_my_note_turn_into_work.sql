-- P5-1 · Turn into task and Turn into action item (V433, TECH-SPEC §3.3a): a My day note becomes a task through
-- api.task_create, or an action item on a task through api.action_item_add, in one request with its link and its
-- mentions — one Undo takes back both; the note's "turned into" chip names the task (number, title) or the item (its
-- text and its task). An achievement still answers note.turn_into_not_yet until P5-4. Forward-only (V103).

-- ================================================================ a note's first words: its title, else the first line
-- of its words, else its first checklist item — what a task's title or an action item's text starts from
create function my.note_headline(n my.note, p_max int) returns text
language sql stable set search_path = ''
as $$
  select pg_catalog.left(coalesce(
    nullif(pg_catalog.btrim(n.title), ''),
    nullif(pg_catalog.btrim(pg_catalog.split_part(pg_catalog.btrim(n.body, E' \t\r\n'), E'\n', 1)), ''),
    (select pg_catalog.btrim(i ->> 'text') from pg_catalog.jsonb_array_elements(n.items) with ordinality x(i, o)
     where pg_catalog.btrim(coalesce(i ->> 'text', '')) <> '' order by o limit 1)), p_max)
$$;

-- One checklist row of a note, by its place (0 first): what a row turned into a task or an action item starts from.
create function my.note_item(n my.note, p_item jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  i jsonb;
begin
  if pg_catalog.jsonb_typeof(p_item) = 'number' and (p_item #>> '{}') ~ '^[0-9]+$' then
    i := n.items -> (p_item #>> '{}')::int;
  end if;
  if i is null then
    raise exception using errcode = 'P0001', message = 'note.item_not_found', detail = p_item #>> '{}';
  end if;
  return i;
end
$$;

-- ================================================================ the conversion (my.turn_into_inner as P3-13 wrote it,
-- with the task and the action item; Wrap up's "turn into" choice goes through it too)
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
  r jsonb;
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
  elsif p_kind = 'task' then
    -- Through the task's own door: its title the note's title (else its first words), its notes the note's words, its
    -- organisation the meeting's unless named, dated the day the note was captured. One checklist row (`item`, its place)
    -- gives the title alone, with the row's owner and due day. Whoever the note mentions and may see the task is
    -- mentioned on it; the others are named back, never told.
    if v ? 'item' then
      r := my.note_item(n, v -> 'item');
    end if;
    pid := coalesce(nullif(v ->> 'partner_id', '')::uuid, n.meeting_partner_id);
    a := work.task_create(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
           'title', coalesce(pg_catalog.left(r ->> 'text', 300), my.note_headline(n, 300)),
           'notes', case when r is null then nullif(pg_catalog.btrim(my.note_text(n)), '') end,
           'owner_id', r ->> 'owner_id',
           'due_on', r ->> 'due_on',
           'partner_id', pid,
           'happened_on', n.happened_on,
           'origin', case when n.kind = 'meeting' then 'meeting' else 'manual' end)) || (v - 'partner_id' - 'item'));
    rid := (a ->> 'id')::uuid;
    select pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where authz.can_see_as(m.person_id, 'work.task', rid) and work.person_ok(m.person_id)),
           pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where not (authz.can_see_as(m.person_id, 'work.task', rid) and work.person_ok(m.person_id)))
      into carried, left_out
    from my.note_mention m where m.note_id = n.id and m.deleted_at is null;
    if carried is not null then
      perform core.note_add('task', rid, 'comment', my.note_text(n), n.happened_on, carried);
    end if;
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'work.task', rid);
    return a || pg_catalog.jsonb_build_object('entity', 'task',
                                              'mentions_left_out', coalesce(pg_catalog.to_jsonb(left_out), '[]'::jsonb));
  elsif p_kind = 'action_item' then
    -- On a task the caller may change: its text the note's first words (or one checklist row's, with its owner and due
    -- day), owned as the task's door decides unless named; whoever the note mentions and may see the task helps on it.
    rid := nullif(v ->> 'task_id', '')::uuid;
    if rid is null then
      raise exception using errcode = 'P0001', message = 'note.turn_into_needs_task';
    end if;
    if v ? 'item' then
      r := my.note_item(n, v -> 'item');
    end if;
    select pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where authz.can_see_as(m.person_id, 'work.task', rid) and work.person_ok(m.person_id)),
           pg_catalog.array_agg(m.person_id order by m.created_at, m.person_id)
             filter (where not (authz.can_see_as(m.person_id, 'work.task', rid) and work.person_ok(m.person_id)))
      into carried, left_out
    from my.note_mention m where m.note_id = n.id and m.deleted_at is null;
    a := work.action_item_add(rid, pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
           'text', coalesce(r ->> 'text', my.note_headline(n, 500)),
           'owner_id', r ->> 'owner_id',
           'due_on', r ->> 'due_on',
           'helper_ids', pg_catalog.to_jsonb(carried),
           'happened_on', n.happened_on)) || (v - 'task_id' - 'item'));
    insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'work.action_item', (a ->> 'id')::uuid);
    return a || pg_catalog.jsonb_build_object('entity', 'action_item', 'task_id', rid,
                                              'mentions_left_out', coalesce(pg_catalog.to_jsonb(left_out), '[]'::jsonb));
  elsif p_kind = 'achievement' then
    raise exception using errcode = 'P0001', message = 'note.turn_into_not_yet', detail = p_kind;
  end if;
  raise exception using errcode = 'P0001', message = 'note.turn_into_invalid', detail = p_kind;
end
$$;

-- ================================================================ one request, labelled as the record it made
create or replace function my.note_turn_into(p_note uuid, p_kind text, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_note);
  req uuid;
  r jsonb;
begin
  req := audit.begin('ui', case p_kind when 'activity' then 'partner.activity_logged' when 'task' then 'task.created'
                                     when 'action_item' then 'action_item.added' else 'reminder.set' end,
                     pg_catalog.jsonb_build_object('kind', p_kind));
  r := my.turn_into_inner(n, p_kind, p_values);
  perform audit.end();
  return r || pg_catalog.jsonb_build_object('note_id', p_note, 'request_id', req);
end
$$;

-- ================================================================ the note's chip names the task or the item
create or replace function my.turned_into(p_note uuid, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'entity', case l.entity_table when 'core.note' then 'activity' when 'core.reminder' then 'reminder'
                                         else e.key end,
           'id', l.entity_id, 'made_at', l.created_at, 'made_by', l.created_by,
           'partner_id', a.entity_id, 'partner_name_en', p.trade_name_en, 'partner_name_ar', p.trade_name_ar,
           'type', t.key, 'type_en', t.name_en, 'type_ar', t.name_ar, 'happened_on', a.happened_on,
           'remind_at', r.remind_at, 'sent_at', r.sent_at,
           'task_id', coalesce(k.id, ai.task_id), 'number', coalesce(k.number, ak.number), 'title', coalesce(k.title, ak.title),
           'text', ai.text, 'due_on', coalesce(ai.due_on, k.due_on)) order by l.created_at, l.id), '[]'::jsonb)
  from my.note_link l
  join core.entity e on e.table_name = l.entity_table
  left join core.note a on l.entity_table = 'core.note' and a.id = l.entity_id
  left join partner.partner p on a.entity_table = 'partner.partner' and p.id = a.entity_id
  left join partner.activity_type t on t.id = a.activity_type_id
  left join core.reminder r on l.entity_table = 'core.reminder' and r.id = l.entity_id
  left join work.task k on l.entity_table = 'work.task' and k.id = l.entity_id
  left join work.action_item ai on l.entity_table = 'work.action_item' and ai.id = l.entity_id
  left join work.task ak on ak.id = ai.task_id
  where l.note_id = p_note and l.deleted_at is null and core.record_live(l.entity_table, l.entity_id)
    and authz.can_see_as(p_reader, l.entity_table, l.entity_id)
$$;
