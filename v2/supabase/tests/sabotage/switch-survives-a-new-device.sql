-- Sabotage: switch-survives-a-new-device
-- Breaks: sql:SWITCH-01
-- Expect: a new device is the owner's own, not switched
-- The switch follows the person to any of their devices, not the one that switched.
create or replace function authz.switch_target(p_real uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select d.as_person_id
  from core.device_session d
  join core.person t on t.id = d.as_person_id
  where p_real is not null
    and d.person_id = p_real and d.signed_out_at is null
    and t.is_test and t.active and t.deleted_at is null
    and exists (select 1 from core.test_switch_holder h join core.person o on o.id = h.person_id
                join core.role r on r.id = o.role_id
                where h.person_id = p_real and r.is_admin)
$$;
