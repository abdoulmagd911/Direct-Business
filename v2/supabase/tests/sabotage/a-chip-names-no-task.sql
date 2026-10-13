-- Sabotage: a-chip-names-no-task
-- Breaks: sql:NOTE-07
-- Expect: its chip names the task by number
-- The note's chip shows a task without its number.
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
           'task_id', coalesce(k.id, ai.task_id), 'title', coalesce(k.title, ak.title),
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
