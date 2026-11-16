-- Landing 31 — the Partners list's fourth card, Quiet, becomes real. Until now "quiet" (a client with no fully paid
-- invoice for `finance.quiet_client_days`, 60) lived only inside the daily alert notify.alert_quiet_client()
-- (20261011080657); the list read could neither flag it nor filter by it, so the card was drawn "not counted yet".
-- Forward-only. Three things, no signature, grant or type change (database.types.ts is unchanged):
-- 1. finance.quiet_clients() — the alert's rule, lifted out word for word, so the alert and the list cannot drift.
-- 2. notify.alert_quiet_client() — the same alert as before, now reading that rule from (1). Who is told, the key,
--    the words and the once-only check are untouched (FAL-01, ALR-01 hold as they were).
-- 3. partner.partners_list — copied whole from 20261109000037 (FIX-45), with three additions only:
--    a. filter `quiet` (true / false), passed exactly as `stale` is;
--    b. each row's flags carry 'quiet' after the others (stale and contract expiring come first: V98's order);
--    c. filter `counts: true` adds `counts` {all, active, prospect, stale, quiet} to the answer: the same list with
--       the search and every other filter on, but without the status / stale / quiet choice — so the four cards are
--       counted by the one list read instead of four more. The rows counted are the rows the reader may see (the
--       same `base`), so a count never tells of a partner the list would not show.
--    The quiet rule reads finance.money_row, which is heavy; the other callers of this read (the client pickers on
--    Tasks, Reports and Codes) must not pay for it. So it runs only when asked — `counts` or `quiet` in the filters —
--    and then once per call, never per row. Without those keys the answer is exactly what it was.
--    Quiet is a Finance fact, so a reader below View on Finance is told none of it (as FAL-02 rules for the alerts):
--    no flag, a null count, and `quiet: true` finds nobody.
-- partners_list has no ALTER FUNCTION ... SET option to carry over (only the search_path in its definition).

-- The partners that are quiet today, with the day of their latest counted invoice (paid day, else created day).
-- Counted = finance.money_row.counted, the Overview's fully-paid gate. An archived or merged partner is never quiet;
-- one with no counted invoice at all is not quiet either (it has never paid, it has not gone quiet).
-- jit = off: finance.money_row's expressions cost seconds to JIT-compile and milliseconds to run (L25, L27, L28).
create function finance.quiet_clients() returns table (partner_id uuid, last_on date)
language sql stable security definer set search_path = '' set jit = off
as $$
  select q.partner_id, q.last_on
  from (select r.partner_id, max(coalesce(r.paid_on, r.created_on)) as last_on
        from finance.money_row r where r.counted and r.partner_id is not null group by r.partner_id) q
  join partner.partner p on p.id = q.partner_id and p.archived_at is null and p.merged_into_id is null
  where q.last_on + coalesce((core.setting_at('finance.quiet_client_days', null, core.riyadh_today()) #>> '{}')::int, 60)
        <= core.riyadh_today()
$$;
revoke all on function finance.quiet_clients() from public;

create or replace function notify.alert_quiet_client() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select finance.account_manager_of(q.partner_id), 'quiet_client:' || q.partner_id || ':' || q.last_on, 'partner.partner',
           q.partner_id, 'alert.quiet_client', pg_catalog.jsonb_build_object('name', p.trade_name_en, 'last_on', q.last_on)
    from finance.quiet_clients() q
    join partner.partner p on p.id = q.partner_id
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where a.person_id is not null
    and not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;

create or replace function partner.partners_list(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  f jsonb := coalesce(p_filters, '{}');
  v_side text := f ->> 'side';
  me uuid;
  q text := norm.fold(f ->> 'q');
  v_counts boolean := coalesce((f ->> 'counts')::boolean, false);
  -- the quiet rule is read only when the caller asks for the counts or filters by quiet — and may see Finance
  v_quiet boolean := false;
begin
  if v_side is not null and v_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = v_side;
  end if;
  if v_side is not null then
    me := authz.require(partner.side_page(v_side), 'view');
  else
    me := authz.me();
    if me is null then
      raise exception using errcode = '42501', message = 'auth.no_active_person';
    end if;
  end if;
  -- Quiet is a Finance fact (who has not paid lately): below View on Finance it is not told at all (FAL-02's rule) —
  -- no flag, no count (null: not known, never 0), and the quiet filter finds nobody quiet.
  v_quiet := (v_counts or f ->> 'quiet' is not null) and authz.level_of(me, 'finance') >= 'view';
  return (
    with base as (
      select p.*, sd.type_key, sd.tier_id as side_tier_id, sd.status, sd.owner_id
      from partner.partner p
      left join lateral (select t.key as type_key, s.tier_id, partner.status_of(p.id, s.side) as status,
                                (select x from partner.side_owners(p.id, s.side) x limit 1) as owner_id
                         from partner.partner_side s join partner.side_type t on t.id = s.type_id
                         where s.partner_id = p.id and s.side = v_side and s.deleted_at is null) sd on v_side is not null
      where p.deleted_at is null
        and case
              when coalesce((f ->> 'archived_only')::boolean, false) then p.archived_at is not null
              when coalesce((f ->> 'include_archived')::boolean, false) then true
              else p.archived_at is null
            end
        and case when v_side is not null then partner.side_on(p.id, v_side)
                 else partner.level_of(me, p.id) >= 'view' end
    ), quiet as materialized (
      select qc.partner_id from finance.quiet_clients() qc where v_quiet
    ), pre as materialized (
      -- the list under the search and every filter but the cards' own (status, stale, quiet): what the cards count
      select b.* from base b
      where (q is null or norm.fold(b.trade_name_en) like '%' || q || '%' or norm.fold(b.trade_name_ar) like '%' || q || '%'
             or norm.fold(b.number) like '%' || q || '%')
        and (f -> 'types' is null or b.type_key in (select x from pg_catalog.jsonb_array_elements_text(f -> 'types') x))
        and (f -> 'tiers' is null or b.side_tier_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'tiers') x))
        and (f -> 'owners' is null or b.owner_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'owners') x))
        and (f -> 'priorities' is null or b.priority_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'priorities') x))
        and (f ->> 'key_partner' is null or b.key_partner = (f ->> 'key_partner')::boolean)
    ), hit as materialized (
      select b.* from pre b
      where (f -> 'statuses' is null or coalesce(b.status, 'none') in (select x from pg_catalog.jsonb_array_elements_text(f -> 'statuses') x))
        and (f ->> 'stale' is null or (partner.stale_on(b.id) <= core.riyadh_today()) = (f ->> 'stale')::boolean)
        and (f ->> 'quiet' is null or (b.id in (select qc.partner_id from quiet qc)) = (f ->> 'quiet')::boolean)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from hit),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'number', h.number, 'trade_name_en', h.trade_name_en, 'trade_name_ar', h.trade_name_ar,
          'type', h.type_key, 'status', h.status, 'owner_id', h.owner_id,
          'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(h.id, s.side) order by s.side)
                             from partner.partner_side s where s.partner_id = h.id and s.deleted_at is null
                               and partner.side_on(h.id, s.side)
                               and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
          'priority_id', h.priority_id, 'key_partner', h.key_partner, 'logo_file_id', h.logo_file_id,
          'last_activity_on', partner.last_activity_on(h.id),
          'flags', partner.flags(h.id, me, v_side)
                   || case when v_quiet and h.id in (select qc.partner_id from quiet qc) then '["quiet"]'::jsonb
                           else '[]'::jsonb end,
          'archived', h.archived_at is not null, 'version', h.version, 'created_at', h.created_at)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb))
      || case when v_counts then pg_catalog.jsonb_build_object('counts', (
           select pg_catalog.jsonb_build_object(
             'all', pg_catalog.count(*),
             'active', pg_catalog.count(*) filter (where c.status = 'active'),
             'prospect', pg_catalog.count(*) filter (where c.status = 'prospect'),
             'stale', pg_catalog.count(*) filter (where partner.stale_on(c.id) <= core.riyadh_today()),
             'quiet', case when v_quiet
                           then pg_catalog.count(*) filter (where c.id in (select qc.partner_id from quiet qc)) end)
           from pre c))
         else '{}'::jsonb end);
end
$$;
