-- Sabotage: a-retired-capability-blocks-a-role
-- Breaks: sql:ACC-09
-- Expect: and makes a head of a role still carrying its grant
-- A retired capability still counts: a grant it left on a role stops an admin from giving that role.
create or replace function core.access_set_person_role(p_person uuid, p_role uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  target core.role;
  req uuid;
  x core.person;
  over text;
begin
  select * into target from core.role where id = p_role and active;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if target.is_admin and not authz.is_admin() then
    raise exception using errcode = '42501', message = 'access.admins_only';
  end if;
  if not target.is_admin then
    select l.page_key into over from core.role_page_level l join core.page pg on pg.key = l.page_key and pg.active
    where l.role_id = p_role and l.deleted_at is null and l.level > authz.level_of(me, l.page_key)
    order by l.page_key limit 1;
    if over is not null then
      raise exception using errcode = '42501', message = 'access.above_your_level',
        detail = pg_catalog.jsonb_build_object('page', over)::text;
    end if;
    select c.capability_key into over from core.role_capability c
    where c.role_id = p_role and c.granted and c.deleted_at is null and not authz.can_of(me, c.capability_key)
    order by c.capability_key limit 1;
    if over is not null then
      raise exception using errcode = '42501', message = 'access.above_your_level',
        detail = pg_catalog.jsonb_build_object('capability', over)::text;
    end if;
  end if;
  req := audit.begin('ui', 'access.person_role_set', pg_catalog.jsonb_build_object('role', target.key), why);
  update core.person set role_id = p_role where id = p_person returning * into x;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;
