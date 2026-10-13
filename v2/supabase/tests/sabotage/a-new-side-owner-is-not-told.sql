-- Sabotage: a-new-side-owner-is-not-told
-- Breaks: sql:HAND-01
-- Expect: named the owner, they are told
-- A side's new owner is not told they own it (V456).
create or replace function partner.side_owner_set_inner(p_id uuid, p_side text, p_person uuid, p_from date, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  cur partner.side_owner;
  days int := coalesce((core.setting_at('work.handover_follow_days', null, core.riyadh_today()) #>> '{}')::int, 30);
begin
  if p_person is not null and not exists (select 1 from core.person x where x.id = p_person and x.kind = 'staff'
                                          and x.active and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_person is not null and not core.person_available(p_person) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_person::text;
  end if;
  select * into cur from partner.side_owner m
  where m.partner_id = p_id and m.side = p_side and m.deleted_at is null and m.effective_from <= p_from
    and (m.effective_to is null or m.effective_to > p_from);
  if cur.id is not null and cur.person_id is not distinct from p_person then
    return;
  end if;
  if cur.id is not null then
    if cur.effective_from = p_from then
      update partner.side_owner set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
      where id = cur.id;
    else
      update partner.side_owner set effective_to = p_from where id = cur.id;
      if days > 0 and core.person_available(cur.person_id) then
        insert into notify.follow (person_id, entity_table, entity_id, until_on)
        values (cur.person_id, 'partner.partner', p_id, p_from + days)
        on conflict (person_id, entity_table, entity_id) do update
          set until_on = greatest(notify.follow.until_on, excluded.until_on)
          where notify.follow.until_on is not null;
      end if;
    end if;
  end if;
  if p_person is not null then
    begin
      insert into partner.side_owner (partner_id, side, person_id, effective_from, reason)
      values (p_id, p_side, p_person, p_from, p_reason);
    exception when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'partner.owner_later_change';
    end;
  end if;
end
$$;
