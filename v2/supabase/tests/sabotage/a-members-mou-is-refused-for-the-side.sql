-- Sabotage: a-members-mou-is-refused-for-the-side
-- Breaks: sql:ACH-09
-- Expect: access.needs
-- The Prospect step asks the logger's rights on the side again (QA-512): a member's MoU is refused outright (V601).
create or replace function perf.mou_prospect(p_achievement uuid, p_number text, p_partner uuid, p_side text, p_on date)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  outer_id text := pg_catalog.current_setting('app.request_id', true);
  outer_depth text := pg_catalog.current_setting('app.request_depth', true);
  sid uuid;
begin
  if p_partner is null or p_side is null
     or not exists (select 1 from partner.partner_side s
                    where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null)
     or exists (select 1 from partner.side_status_change s
                where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null) then
    return null;
  end if;
  perform partner.side_writable(p_partner, p_side);
  perform authz.require_capability(partner.side_page(p_side) || '.assign');
  perform pg_catalog.set_config('app.request_depth', '0', true);
  perform pg_catalog.set_config('app.request_id', '', true);
  perform audit.begin('ui', 'perf.mou_prospect', pg_catalog.jsonb_build_object('side', p_side, 'status', 'prospect',
                      'achievement', p_number, 'achievement_id', p_achievement));
  perform audit.happened(p_on);
  insert into partner.side_status_change (partner_id, side, status, effective_on, note)
  values (p_partner, p_side, 'prospect', p_on, 'From MoU ' || p_number)
  returning id into sid;
  perform audit.end();
  perform pg_catalog.set_config('app.request_id', coalesce(outer_id, ''), true);
  perform pg_catalog.set_config('app.request_depth', coalesce(nullif(outer_depth, ''), '0'), true);
  return sid;
end
$$;
