-- Sabotage: a-meeting-note-is-on-time-whenever-written
-- Breaks: sql:MSR-01
-- Expect: meeting notes: written the same day or the next are on time
-- A meeting note written days after the meeting still counts as on time.
create or replace function measure.work_meeting_notes_on_time_items(p_params jsonb, p_scope_kind text, p_scope_id uuid,
                                                         p_from date, p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform measure.check_scope(p_scope_kind);
  return query
  select 'core.note'::text, n.id, n.created_by, n.happened_on,
         true
  from core.note n
  left join partner.activity_type ty on ty.id = n.activity_type_id
  left join core.person p on p.id = n.created_by
  left join work.task k on n.entity_table = 'work.task' and k.id = n.entity_id
  where n.deleted_at is null and n.happened_on between p_from and least(p_to, core.riyadh_today())
    and (n.kind = 'meeting_note' or (n.kind = 'activity' and ty.key = 'meeting'))
    and measure.in_scope(p_scope_kind, p_scope_id, n.created_by, p.team_id, p.department_id,
                         case n.entity_table when 'partner.partner' then n.entity_id else k.partner_id end)
  order by n.happened_on, n.id;
end
$$;
