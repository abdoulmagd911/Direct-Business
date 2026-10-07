-- Sabotage: a-checklist-item-names-no-note
-- Breaks: sql:NOTE-09
-- Expect: an item shows the note it came from
-- The action items made from a note's rows are not linked to the note (V184).
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
  with_items boolean := false;
  p jsonb;
  ai jsonb;
  made jsonb := '[]'::jsonb;
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
    -- When asked (`action_items`: true), the note's checklist rows become the task's action items, in order, in the
    -- same request: each keeps its text, owner and due day under the task door's rules, a ticked row is a done
    -- item, and each shows the note it came from. Unasked, nothing else is made (V602). A task from one row
    -- (`item`) brings no others.
    if v ? 'action_items' then
      if pg_catalog.jsonb_typeof(v -> 'action_items') <> 'boolean' or (v ? 'item' and (v ->> 'action_items')::boolean)
      then
        raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'action_items';
      end if;
      with_items := (v ->> 'action_items')::boolean;
    end if;
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
           'origin', case when n.kind = 'meeting' then 'meeting' else 'manual' end))
         || (v - 'partner_id' - 'item' - 'action_items'));
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
    if with_items then
      for p in select x from pg_catalog.jsonb_array_elements(n.items) with ordinality e(x, o) order by o loop
        ai := work.action_item_add(rid, pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
                'text', p ->> 'text', 'owner_id', p ->> 'owner_id', 'due_on', p ->> 'due_on',
                'happened_on', n.happened_on)));
        if coalesce((p ->> 'done')::boolean, false) then
          perform work.action_item_done((ai ->> 'id')::uuid, true, n.happened_on);
        end if;
        made := made || pg_catalog.jsonb_build_array(ai ->> 'id');
      end loop;
    end if;
    return a || pg_catalog.jsonb_build_object('entity', 'task', 'action_item_ids', made,
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
  end if;
  raise exception using errcode = 'P0001', message = 'note.turn_into_invalid', detail = p_kind;
end
$$;
