-- Sabotage: switching-off-leaves-devices-live
-- Breaks: sql:PPL-02
-- Expect: switched off, both devices end at once
-- Switching a person off leaves their devices signed in until something else notices.
create or replace function core.person_switch(p_id uuid, p_on boolean, p_reason text, p_reassign_to uuid default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.person_guard_write(p_id);
  why text := core.access_reason(p_reason);
  req uuid;
  ended int := 0;
  handed jsonb;
  n int := 0;
begin
  if p_id = me then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  if p_on and exists (select 1 from core.person p where p.id = p_id and p.left_on <= core.riyadh_today()) then
    raise exception using errcode = 'P0001', message = 'person.has_left';
  end if;
  if p_on and p_reassign_to is not null then
    raise exception using errcode = 'P0001', message = 'person.reassign_needs_off';
  end if;
  if p_reassign_to is not null then
    n := core.open_work_count(core.open_work(p_id));
  end if;
  req := audit.begin('ui', case when p_on then 'person.switched_on' else 'person.switched_off' end,
                     case when p_reassign_to is not null then pg_catalog.jsonb_build_object('count', n) end, why);
  if p_reassign_to is not null then
    handed := core.hand_over(p_id, p_reassign_to);
  end if;
  update core.person set can_sign_in = p_on where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('can_sign_in', p_on, 'devices_ended', ended, 'handed_over', handed,
                                       'request_id', req);
end
$$;
