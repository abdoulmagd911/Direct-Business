-- Sabotage: retiring-a-team-strands-its-people
-- Breaks: sql:TEAM-01
-- Expect: retiring a team moves its two people
-- Retiring a team leaves its people in a team that no longer exists.
create or replace function core.team_retire(p_id uuid, p_move_to uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  why text := core.access_reason(p_reason);
  t core.team;
  req uuid;
  moved int;
begin
  select * into t from core.team where id = p_id;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not t.active then
    raise exception using errcode = 'P0001', message = 'team.retired';
  end if;
  if p_move_to is not null and not exists (select 1 from core.team x where x.id = p_move_to and x.id <> p_id
                                           and x.active and x.department_id = t.department_id) then
    raise exception using errcode = 'P0001', message = 'team.move_to_invalid';
  end if;
  req := audit.begin('ui', 'team.retired', null, why);
  moved := 0;
  update core.person_team_assist set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = why
  where team_id = p_id and deleted_at is null;
  update core.team set active = false, retired_at = pg_catalog.now(), retired_into_team_id = p_move_to where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('moved', moved, 'request_id', req);
end
$$;
