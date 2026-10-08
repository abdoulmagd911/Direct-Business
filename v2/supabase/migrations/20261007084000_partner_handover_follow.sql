-- P3-8c (part 4) · a side's hand-over (V488, V456) and national IDs never kept (OLD-033). Forward-only (V103).
--  · A change of a side's owner tells the new owner ('assigned', V456) and makes the previous owner — one who owned it
--    since before that day and can still work here — a follower of the organisation for `work.handover_follow_days`
--    (30; 0 turns it off). A nightly job ends those follows; a person who follows the record themselves keeps it.
--    A same-day correction of the owner is no hand-over.
--  · core.looks_secret also refuses a national ID or residence-permit number named as such, in English or Arabic: no
--    national ID is ever kept (OLD-033, V428).

-- ================================================================ a follow that ends (V488)
alter table notify.follow add column until_on date;
comment on column notify.follow.until_on is
  'A hand-over follow (V488) ends after this day (the nightly job removes it); null: followed until unfollowed.';

-- notify.follow_set as P3-6b wrote it, plus: following a record yourself keeps the follow (a hand-over follow becomes
-- your own).
create or replace function notify.follow_set(p_entity text, p_id uuid, p_on boolean) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity := core.can_see_record(p_entity, p_id);
begin
  if p_on then
    insert into notify.follow (person_id, entity_table, entity_id) values (me, e.table_name, p_id)
    on conflict (person_id, entity_table, entity_id) do update set until_on = null;
  else
    delete from notify.follow where person_id = me and entity_table = e.table_name and entity_id = p_id;
  end if;
  return p_on;
end
$$;

-- The nightly job: every hand-over follow past its last day ends. Returns how many.
create function notify.end_handover_follows() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k int;
begin
  delete from notify.follow where until_on < core.riyadh_today();
  get diagnostics k = row_count;
  return k;
end
$$;
comment on function notify.end_handover_follows() is 'The hand-over follow job (V488): each follow past its last day ends.';
revoke all on function notify.end_handover_follows() from public;

do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('notify-end-handover-follows', '15 21 * * *', 'select notify.end_handover_follows()');
  end if;
end $$;

-- ================================================================ a side changes hands (V488, V456)
-- partner.side_owner_set_inner as P3-6f wrote it, plus: the new owner is told, and the previous owner — when they owned
-- it since before this day and can still work here — follows the organisation until the hand-over follow ends (a
-- follow they already keep stays theirs).
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
    perform notify.push_assigned(p_person, 'assigned', 'partner.partner', p_id);
  end if;
end
$$;

-- ================================================================ no national ID is ever kept (OLD-033)
-- core.looks_secret as P3-8b-2 wrote it, plus a national ID, a residence permit (iqama) or a civil ID named as such.
-- The words are needed: a bare ten-digit number is as often a commercial registration, and "إقامة" alone is a hotel stay.
create or replace function core.looks_secret(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    p ~* '(^|[^a-z])(password|passcode|passwd|pass|pwd|secret|token|pin|otp|credentials?)([^a-z]|$)'
    or p ~ '(كلمة\s*(ال)?(مرور|سر)|الرقم\s*السري|رمز\s*(ال)?دخول)'
    or p ~* '^[a-z][a-z0-9+.-]*://[^/?#@[:space:]]*:[^/?#@[:space:]]*@'
    or p ~* '[?&;](access_token|api_?key|apikey|auth|key|sig|signature)='
    or p ~* '(^|[^a-z])(national\s*id(entity)?|iqama|civil\s*id|id\s*card\s*(no|number))([^a-z]|$)'
    or p ~ '(رقم\s*(ال)?هوية|(ال)?هوية\s*(ال)?وطنية|رقم\s*(ال)?[إا]قامة|هوية\s*مقيم|(ال)?سجل\s*(ال)?مدني)', false)
$$;
