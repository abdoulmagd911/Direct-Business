-- Sabotage: tender-ids-are-limited
-- Breaks: sql:IDN-06
-- Expect: a third tender ID is not refused
-- Tender IDs are limited like the others instead of unlimited (V422).
create or replace function partner.open_client_id_limit(p_subkind text) returns int
language sql stable security definer set search_path = ''
as $$
  select case when p_subkind is null then null
              else coalesce((core.setting_at('partner.open_client_ids', null, core.riyadh_today()) ->> p_subkind)::int, 2) end
$$;
