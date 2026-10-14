-- Sabotage: a-follow-up-shows-to-others-on-the-record
-- Breaks: sql:FUP-02
-- Expect: an admin who sees the client sees no one else's follow-up on it
-- The record page's read gives everyone who may see the record every follow-up on it, not only their own (V454).
create or replace function my.my_follow_ups(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  tbl text := case p_entity when 'partner' then 'partner.partner' when 'task' then 'work.task'
                            when 'invoice' then 'finance.invoice' end;
begin
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'note.about_invalid', detail = p_entity;
  end if;
  if p_id is null or not authz.can_see_as(me, tbl, p_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = tbl;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', r.id, 'note_id', r.note_id, 'remind_at', r.remind_at, 'text', r.text,
             'told', r.sent_at is not null) order by r.remind_at, r.id)
    from my.note n
    join core.reminder r on r.note_id = n.id and r.deleted_at is null
    where n.deleted_at is null and n.about_table = tbl and n.about_id = p_id
      -- open: still to come, or told and its alert not yet dismissed (as core.reminders_due reads it)
      and (r.sent_at is null or exists (select 1 from notify.notification x
                                        where x.person_id = me and x.entity_table = 'core.reminder'
                                          and x.entity_id = r.id and x.read_at is null))), '[]'::jsonb);
end
$$;
