-- A retired capability grants nothing, and stops nothing (V176 — the production bug of 29 Sep: Settings → People
-- refused to make anyone a head of department or a manager, "You cannot grant more than you have").
-- partners.assign, partners.identify and partners.merge gave way to each side's own (V98): the registry sync made them
-- inactive, but their grants stayed live on the admin, head and manager roles. authz.can_of answers no for an inactive
-- capability — even for an admin — so core.access_set_person_role found a grant "above" the admin and refused.
--   1. the grants of every inactive capability, on roles and on people, are soft-deleted (logged, one system request);
--   2. core.access_can_grant lets an inactive capability pass: it grants nothing, so it is above no one;
--   3. core.access_set_person_role asks only the capabilities still in use.
-- A capability the registry brings back later starts again from the registry's grants (the sync writes them "where it
-- has none").

-- ================================================================ 1. the grants of a retired capability go
select audit.begin('system', 'access.retired_capabilities_cleared', null, 'V176: a retired capability grants nothing');
update core.role_capability c set deleted_at = pg_catalog.now(), deleted_by = core.system_person_id(),
                                  delete_reason = 'V176: the capability is retired'
where c.deleted_at is null
  and exists (select 1 from core.capability k where k.key = c.capability_key and not k.active);
update core.person_capability c set deleted_at = pg_catalog.now(), deleted_by = core.system_person_id(),
                                    delete_reason = 'V176: the capability is retired'
where c.deleted_at is null
  and exists (select 1 from core.capability k where k.key = c.capability_key and not k.active);
select audit.end();

-- ================================================================ 2. granting a retired capability is above no one
create or replace function core.access_can_grant(p_me uuid, p_capability text) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from core.capability c where c.key = p_capability and c.active) then
    return;
  end if;
  if not authz.can_of(p_me, p_capability) then
    raise exception using errcode = '42501', message = 'access.above_your_level',
      detail = pg_catalog.jsonb_build_object('capability', p_capability)::text;
  end if;
end
$$;

-- ================================================================ 3. a role is checked on the capabilities in use
-- core.access_set_person_role as P3-4 wrote it, with the capability check joined to core.capability.active.
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
    join core.capability k on k.key = c.capability_key and k.active
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

-- ================================================================ the seeds' Arabic (the oversight, 29 Sep)
-- The screens call a department إدارة, so the head of one is رئيس الإدارة; "later" is written لاحقًا. Only a name
-- still as seeded changes: one an admin has renamed in Settings stays theirs.
select audit.begin('system', 'registry.seed_wording', null, 'V176: the seeds'' Arabic');
update core.role set name_ar = 'رئيس الإدارة' where key = 'head' and name_ar = 'رئيس القسم';
update partner.activity_outcome set name_ar = 'معاودة الاتصال لاحقًا'
where key = 'call_back_later' and name_ar = 'معاودة الاتصال لاحقاً';
select audit.end();
