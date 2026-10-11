-- One official client count (V477; spec §3.4, §3.7a): on a day, sign-ups = organisations with the Client side on;
-- onboarded = of those, the side has reached Active; active = of those, a counted unit created inside
-- `partner.active_client_days` (90) up to that day. Split by segment — the Client side's type (V98). The measure
-- partner.active_clients reads it (params: count — sign_ups, onboarded or active, default active — and an optional
-- segment key); the Commercial overview's tile and the Clients list header read api.partner_client_counts.
-- Forward-only.

-- Every organisation with the Client side on a day: its segment, onboarded and active, and its account manager then.
create function partner.client_rows(p_on date)
  returns table (partner_id uuid, segment_key text, onboarded boolean, active boolean, owner_id uuid, team_id uuid,
                 department_id uuid)
language sql stable security definer set search_path = ''
as $$
  select s.partner_id, t.key,
         exists (select 1 from partner.side_status_change c
                 where c.partner_id = s.partner_id and c.side = 'client' and c.deleted_at is null and c.status = 'active'
                   and c.effective_on <= p_on),
         exists (select 1 from finance.money_row r
                 where r.counted and r.partner_id = s.partner_id
                   and r.created_on between p_on - coalesce((core.setting_at('partner.active_client_days', null, p_on)
                                                             #>> '{}')::int, 90) + 1 and p_on),
         o.person_id, pe.team_id, pe.department_id
  from partner.partner_side s
  join partner.partner p on p.id = s.partner_id and p.archived_at is null and p.merged_into_id is null
  join partner.side_type t on t.id = s.type_id
  left join lateral (select x.person_id from partner.side_owner x
                     where x.partner_id = s.partner_id and x.side = 'client' and x.deleted_at is null
                       and x.effective_from <= p_on and (x.effective_to is null or p_on < x.effective_to)
                     order by x.effective_from desc limit 1) o on true
  left join core.person pe on pe.id = o.person_id
  where s.side = 'client' and s.deleted_at is null and (s.since is null or s.since <= p_on)
    and (s.until is null or s.until > p_on)
$$;

create function measure.partner_active_clients_items(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                                     p_to date) returns setof measure.item
language plpgsql stable security definer set search_path = ''
as $$
declare
  which text := coalesce(p_params ->> 'count', 'active');
begin
  perform measure.check_scope(p_scope_kind);
  if which not in ('sign_ups', 'onboarded', 'active') then
    raise exception using errcode = 'P0001', message = 'measure.unknown_param', detail = 'count';
  end if;
  return query
  select 'partner.partner'::text, c.partner_id, c.owner_id, p_to,
         case which when 'sign_ups' then true when 'onboarded' then c.onboarded else c.active end
  from partner.client_rows(p_to) c
  where (p_params ->> 'segment' is null or c.segment_key = p_params ->> 'segment')
    and measure.in_scope(p_scope_kind, p_scope_id, c.owner_id, c.team_id, c.department_id, c.partner_id)
  order by c.partner_id;
end
$$;
-- How many: a count of the organisations the asked count takes, as of the period's last day (a real 0, measured).
create function measure.partner_active_clients(p_params jsonb, p_scope_kind text, p_scope_id uuid, p_from date,
                                               p_to date) returns measure.result
language sql stable security definer set search_path = ''
as $$
  select (pg_catalog.count(*) filter (where i.counted)::numeric, true,
          (pg_catalog.count(*) filter (where i.counted))::int)::measure.result
  from measure.partner_active_clients_items(p_params, p_scope_kind, p_scope_id, p_from, p_to) i
$$;

-- The three counts on a day, in all and by segment, for the overview tile and the Clients list header.
create function partner.client_counts(p_on date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  d date := coalesce(p_on, core.riyadh_today());
begin
  perform authz.require('clients', 'view');
  return (
    with c as (select * from partner.client_rows(d))
    select pg_catalog.jsonb_build_object(
      'on', d,
      'sign_ups', (select pg_catalog.count(*) from c),
      'onboarded', (select pg_catalog.count(*) from c where c.onboarded),
      'active', (select pg_catalog.count(*) from c where c.active),
      'by_segment', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'segment', g.segment_key, 'sign_ups', g.sign_ups, 'onboarded', g.onboarded, 'active', g.active)
                                order by g.segment_key)
                              from (select c.segment_key, pg_catalog.count(*) as sign_ups,
                                           pg_catalog.count(*) filter (where c.onboarded) as onboarded,
                                           pg_catalog.count(*) filter (where c.active) as active
                                    from c group by c.segment_key) g), '[]'::jsonb))
  );
end
$$;
create function api.partner_client_counts(p_on date default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select partner.client_counts(p_on) $$;

revoke all on function partner.client_rows(date), measure.partner_active_clients_items(jsonb, text, uuid, date, date),
  measure.partner_active_clients(jsonb, text, uuid, date, date), partner.client_counts(date) from public;
grant execute on function partner.client_counts(date) to authenticated;
grant execute on function api.partner_client_counts(date) to authenticated;
