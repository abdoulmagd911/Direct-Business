-- QA-146 — A handover ends the earlier owner's time on the day the new owner starts, with no gap (V63, V136, V149;
-- the scenario catalogue's WRK-090, logged as QA-139): a made-up organisation's Client side has been a team member's
-- since thirty days ago; a head makes a colleague its owner from today (api.partner_owner_set); the earlier owner's
-- time now ends today, so they owned it yesterday and every day before back to their start, the colleague owns it
-- from today, and every day in between has exactly one owner. Written by the QA auditor because PROS-01 only hands over
-- an owner who started the same day (their row is replaced, not ended): ending the earlier owner a day early (m41)
-- left the suite green. Guards: passes on v2/main today and goes red under m41. Made-up values only (V101 shapes).
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.old', test.person('Test Earlier Owner', 'member')::text, true);
select set_config('t.new', test.person('Test New Owner', 'member')::text, true);
select set_config('t.today', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA146', 'sides',
  jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.old')))))
  ->> 'id', true);
-- the earlier owner's time began thirty days ago (as a side owned before this change would read)
select test.as_owner();
update partner.side_owner set effective_from = current_setting('t.today')::date - 30
where partner_id = current_setting('t.p')::uuid and side = 'client' and person_id = current_setting('t.old')::uuid
  and deleted_at is null;
select test.eq((select effective_from from partner.side_owner where partner_id = current_setting('t.p')::uuid
                and person_id = current_setting('t.old')::uuid and deleted_at is null),
  current_setting('t.today')::date - 30, 'the earlier owner has owned the side for thirty days');

create function pg_temp.owner_on(p_day date) returns text
language sql as $$
  select coalesce(string_agg(case m.person_id when current_setting('t.old')::uuid then 'earlier'
                                              when current_setting('t.new')::uuid then 'new' else 'someone' end,
                             ', ' order by m.effective_from), 'nobody')
  from partner.side_owner m
  where m.partner_id = current_setting('t.p')::uuid and m.side = 'client' and m.deleted_at is null
    and m.effective_from <= p_day and (m.effective_to is null or m.effective_to > p_day)
$$;

select test.as_person(current_setting('t.head')::uuid);
select test.ok((api.partner_owner_set(current_setting('t.p')::uuid, 'client', current_setting('t.new')::uuid, null,
  'made up: handover') ->> 'request_id') is not null, 'the head hands the side over from today');
select test.as_owner();
select test.eq((select effective_to from partner.side_owner where partner_id = current_setting('t.p')::uuid
                and person_id = current_setting('t.old')::uuid and deleted_at is null),
  current_setting('t.today')::date, 'the earlier owner''s time ends the day the new owner starts');
select test.eq(pg_temp.owner_on(current_setting('t.today')::date - 1), 'earlier', 'yesterday the earlier owner held it');
select test.eq(pg_temp.owner_on(current_setting('t.today')::date), 'new', 'from today the new owner holds it');
select test.eq((select string_agg(d::date::text || ' ' || pg_temp.owner_on(d::date), ', ')
                from generate_series(current_setting('t.today')::date - 30, current_setting('t.today')::date, '1 day') d
                where pg_temp.owner_on(d::date) not in ('earlier', 'new')), null::text,
  'every day from the earlier owner''s start to today has exactly one owner — no gap');
select test.eq((select array_agg(x) from partner.owners(current_setting('t.p')::uuid) x),
  array[current_setting('t.new')::uuid], 'and the organisation''s owner today is the new one');
