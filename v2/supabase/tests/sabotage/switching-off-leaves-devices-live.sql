-- Sabotage: switching-off-leaves-devices-live
-- Breaks: sql:PPL-02
-- Expect: switched off, both devices end at once
-- Switching a person off leaves their devices signed in until something else notices.
create or replace function core.person_switch(p_id uuid, p_on boolean, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.person_guard_write(p_id);
  why text := core.access_reason(p_reason);
  req uuid;
  ended int := 0;
begin
  if p_id = me then
    raise exception using errcode = '42501', message = 'access.not_your_own';
  end if;
  req := audit.begin('ui', case when p_on then 'person.switched_on' else 'person.switched_off' end, null, why);
  update core.person set can_sign_in = p_on where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('can_sign_in', p_on, 'devices_ended', ended, 'request_id', req);
end
$$;
