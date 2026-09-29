-- QA-144 — Retiring a list value in use needs a reason and the value its records move to, and a key is used once in
-- a list (V97, V133, V210 "needs the entry they move to and a reason"; V125's common.reason_required; the scenario
-- catalogue's ACC-083 and ACC-082, logged as QA-138). An admin retires a made-up Client tier an organisation holds:
-- with no reason, then with no replacement, each is refused and nothing moves — the value stays active and the
-- organisation keeps it; with both, the same call moves it (so the refusals were the rule, not a broken call). A
-- second Client type under a key the Client list already has is refused and the list keeps one. Written by the QA
-- auditor because SETS-01 always retires with both and LIST-01 never reuses a key on the same side: dropping the
-- reason check (m17), the replacement check (m18) or the per-list unique key (m14) left the suite green. The side_tier
-- list is used because its column on the side may be empty, so a retire with no replacement would really go through.
-- Guards: passes on v2/main today and goes red under m17, m18 and m14. Made-up values only (V101 shapes).
create function pg_temp.refused(p_sql text, p_what text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = 'TF001' then
      raise;
    end if;
    return;
  end;
  perform test.fail(p_what || ' — expected a refusal, but the statement ran');
end
$$;
grant execute on function pg_temp.refused(text, text) to authenticated;

select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.old', api.list_save('side_tier', null,
  '{"side": "client", "key": "qa144_old", "name_en": "Made Up Old Tier", "name_ar": "فئة قديمة متخيلة"}') ->> 'id', true);
select set_config('t.new', api.list_save('side_tier', null,
  '{"side": "client", "key": "qa144_new", "name_en": "Made Up New Tier", "name_ar": "فئة جديدة متخيلة"}') ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA144',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'tier_id', current_setting('t.old')))))
  ->> 'id', true);

create function pg_temp.tier_now() returns text
language sql as $$
  select (select t.key || case when t.active then ' active' else ' retired' end from partner.side_tier t
          where t.id = current_setting('t.old')::uuid)
         || ' · held by ' || coalesce((select t.key from partner.partner_side s join partner.side_tier t on t.id = s.tier_id
                                       where s.partner_id = current_setting('t.p')::uuid and s.side = 'client'), 'nothing')
$$;
select test.as_owner();
select test.eq(pg_temp.tier_now(), 'qa144_old active · held by qa144_old', 'the organisation holds the made-up tier');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.list_usage('side_tier', current_setting('t.old')::uuid) ->> 'total')::int, 1, 'it is used once');
select pg_temp.refused(format('select api.list_retire(%L, %L, %L, null)', 'side_tier', current_setting('t.old'),
  current_setting('t.new')), 'retiring a value in use with no reason');
select test.as_owner();
select test.eq(pg_temp.tier_now(), 'qa144_old active · held by qa144_old', 'is refused, and nothing moves');
select test.as_person(current_setting('t.admin')::uuid);
select pg_temp.refused(format('select api.list_retire(%L, %L, null, %L)', 'side_tier', current_setting('t.old'),
  'made up: folded away'), 'retiring a value in use with nothing to move its records to');
select test.as_owner();
select test.eq(pg_temp.tier_now(), 'qa144_old active · held by qa144_old', 'is refused, and nothing moves either');

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.list_retire('side_tier', current_setting('t.old')::uuid, current_setting('t.new')::uuid,
  'made up: folded into the new tier') ->> 'moved')::int, 1, 'with a reason and a replacement the same call moves it');
select test.as_owner();
select test.eq(pg_temp.tier_now(), 'qa144_old retired · held by qa144_new', 'and the organisation holds the replacement');

-- a key is used once in a list (the same key on the other side is another list's entry — LIST-01)
select test.as_person(current_setting('t.admin')::uuid);
select pg_temp.refused($$select api.list_save('side_type', null,
  '{"side": "client", "key": "corporate", "name_en": "Made Up Second Corporate", "name_ar": "شركات متخيلة ثانية"}')$$,
  'a second Client type under the key corporate');
select test.as_owner();
select test.eq((select count(*)::int from partner.side_type where side = 'client' and key = 'corporate'), 1,
  'is refused: the Client type list keeps one corporate');
