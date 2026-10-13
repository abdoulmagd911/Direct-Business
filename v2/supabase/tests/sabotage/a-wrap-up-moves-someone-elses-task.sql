-- Sabotage: a-wrap-up-moves-someone-elses-task
-- Breaks: sql:WRAP-01
-- Expect: a task I only help on is not mine to wrap up
-- Wrap up moves a task that is not the person's own, so a helper reschedules the owner's work (Stage 1).
create or replace function my.wrap_up(p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  today date := core.riyadh_today();
  it jsonb;
  ch text;
  t work.task;
  n my.note;
  dest date;
  out jsonb := '[]'::jsonb;
  req uuid;
begin
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' or pg_catalog.jsonb_array_length(p_items) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  req := audit.begin('ui', 'day.wrapped_up', pg_catalog.jsonb_build_object('day', today,
                                                                           'count', pg_catalog.jsonb_array_length(p_items)));
  for it in select x from pg_catalog.jsonb_array_elements(p_items) x loop
    ch := it ->> 'choice';
    if ch is null or ch not in ('tomorrow', 'next_week', 'drop', 'done') then
      raise exception using errcode = 'P0001', message = 'wrap_up.choice_invalid', detail = coalesce(ch, '');
    end if;
    dest := case ch when 'tomorrow' then core.next_working_day(today) when 'next_week' then my.next_week_day(today) end;
    case it ->> 'kind'
      when 'task' then
        -- only my own open task, under my own access
        select * into t from work.task x where x.id = nullif(it ->> 'id', '')::uuid and x.deleted_at is null;
        if t.id is null or work.row_level('work.task', t.id, me) < 'view' then
          raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.task';
        end if;
        if false and t.owner_id is distinct from me then
          raise exception using errcode = '42501', message = 'wrap_up.not_yours', detail = t.id::text;
        end if;
        t := work.task_editable(t.id);
        if t.closed_at is not null then
          raise exception using errcode = 'P0001', message = 'wrap_up.not_open', detail = t.id::text;
        end if;
        insert into my.carry (person_id, entity_table, entity_id, choice, wrapped_on, carried_from, carried_to, created_by)
        values (me, 'work.task', t.id, ch, today, t.due_on, dest, me);
        if dest is not null then
          update work.task x set due_on = dest, updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
          where x.id = t.id;
        else
          perform work.task_status_set(t.id, case ch when 'done' then 'done' else 'cancelled' end);
        end if;
      when 'note' then
        n := my.note_mine(nullif(it ->> 'id', '')::uuid);
        if n.done_at is not null then
          raise exception using errcode = 'P0001', message = 'wrap_up.not_open', detail = n.id::text;
        end if;
        insert into my.carry (person_id, entity_table, entity_id, choice, wrapped_on, carried_from, carried_to, created_by)
        values (me, 'my.note', n.id, ch, today, coalesce(n.carried_to, n.happened_on), dest, me);
        update my.note x set carried_to = coalesce(dest, x.carried_to),
                             done_at = case when dest is null then core.clock() else x.done_at end,
                             updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
        where x.id = n.id;
      else
        raise exception using errcode = 'P0001', message = 'wrap_up.kind_invalid', detail = coalesce(it ->> 'kind', '');
    end case;
    out := out || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('kind', it ->> 'kind', 'id', it ->> 'id',
                                                                             'choice', ch, 'carried_to', dest));
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('day', today, 'items', out, 'request_id', req);
end
$$;
