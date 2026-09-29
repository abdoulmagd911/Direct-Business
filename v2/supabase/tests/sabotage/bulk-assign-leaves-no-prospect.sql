-- Sabotage: bulk-assign-leaves-no-prospect
-- Breaks: sql:PROS-01
-- Expect: a partner with no status becomes a Prospect
-- Assigning prospects leaves them without a status, so no list shows them as prospects.
create or replace function partner.bulk_assign(p_ids uuid[], p_owner uuid, p_priority uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('partners', 'full');
  pid uuid;
  req uuid;
  n int := 0;
begin
  perform authz.require_capability('partners.assign');
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_priority is not null and not exists (select 1 from work.priority x where x.id = p_priority and x.active) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'partner.bulk_assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  foreach pid in array p_ids loop
    perform partner.writable(pid);
    if p_owner is not null then
      perform partner.manager_set_inner(pid, p_owner, core.riyadh_today(), p_reason);
    end if;
    if p_priority is not null then
      update partner.partner set priority_id = p_priority where id = pid;
    end if;
    n := n + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;
