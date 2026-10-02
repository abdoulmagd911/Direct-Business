-- Sabotage: finish-meeting-leaves-ticked-points-open
-- Breaks: sql:NOTE-08
-- Expect: a ticked point is a done item
-- A point ticked during the meeting becomes an open action item.
create or replace function my.note_finish_meeting(p_note uuid, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n my.note := my.note_mine(p_note);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  day date := coalesce(n.meeting_on, n.happened_on);
  req uuid;
  a jsonb;
  t jsonb;
  tid uuid;
  ai jsonb;
  p jsonb;
  made jsonb := '[]'::jsonb;
begin
  if n.kind <> 'meeting' then
    raise exception using errcode = 'P0001', message = 'note.not_a_meeting';
  end if;
  if n.finished_at is not null then
    raise exception using errcode = 'P0001', message = 'note.meeting_finished';
  end if;
  if coalesce(nullif(v ->> 'partner_id', '')::uuid, n.meeting_partner_id) is null then
    raise exception using errcode = 'P0001', message = 'note.meeting_needs_partner';
  end if;
  req := audit.begin('ui', 'partner.activity_logged', pg_catalog.jsonb_build_object('type', 'meeting'));
  a := my.turn_into_inner(n, 'activity', (v - 'task_id' - 'task') || pg_catalog.jsonb_build_object('type', 'meeting',
         'outcome', coalesce(v ->> 'outcome', 'meeting_held')));
  if pg_catalog.jsonb_array_length(n.items) > 0 then
    tid := nullif(v ->> 'task_id', '')::uuid;
    if tid is null then
      t := my.turn_into_inner(n, 'task', pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
             'partner_id', nullif(v ->> 'partner_id', ''))) || coalesce(v -> 'task', '{}'::jsonb));
      tid := (t ->> 'id')::uuid;
    end if;
    for p in select x from pg_catalog.jsonb_array_elements(n.items) with ordinality e(x, o) order by o loop
      ai := work.action_item_add(tid, pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
              'text', p ->> 'text', 'owner_id', p ->> 'owner_id', 'due_on', p ->> 'due_on', 'happened_on', day)));
      insert into my.note_link (note_id, entity_table, entity_id) values (n.id, 'work.action_item', (ai ->> 'id')::uuid);
      if false then
        perform work.action_item_done((ai ->> 'id')::uuid, true, day);
      end if;
      made := made || pg_catalog.jsonb_build_array(ai ->> 'id');
    end loop;
  end if;
  update my.note set finished_at = core.clock() where id = p_note;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_note, 'activity_id', a ->> 'id', 'partner_id', a ->> 'partner_id',
    'points', pg_catalog.jsonb_array_length(n.items), 'task_id', tid, 'task_made', t is not null,
    'action_item_ids', made, 'mentions_left_out', a -> 'mentions_left_out', 'request_id', req);
end
$$;
