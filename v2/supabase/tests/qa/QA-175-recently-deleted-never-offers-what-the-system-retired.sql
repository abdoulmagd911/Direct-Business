-- QA-175 — Recently deleted never lists, and nobody restores, a row that the system retired (V97, V144; the oversight's
-- production walk W10, 29 Sep 23:55). A migration or the registry sync retires rows inside a request of kind 'system'
-- (a role's page level for a retired page, a setting); those rows are not something a person removed, and restoring one
-- would hand back access or a value that was retired on purpose. Here a system request retires the member role's KPIs
-- level, as a migration would; an admin then removes a person's own override (the control). The admin's Recently
-- deleted lists the override and not the retired level, and a restore of the retired level is refused and changes
-- nothing. Written by the QA auditor to fail until built: on v2/main core.recently_deleted lists every row removed in
-- the window whoever removed it, and core.restore lets an admin bring any of them back.
-- Finding: docs/v2/QA-LOG.md, QA-175. Made-up people only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.x', test.person('Test Member', 'member')::text, true);
select set_config('t.member_role', (select id::text from core.role where key = 'member'), true);

-- the system retires the member role's KPIs level, as a migration does
select test.as_owner();
select set_config('t.rl', (select id::text from core.role_page_level
                           where role_id = current_setting('t.member_role')::uuid and page_key = 'kpis'
                             and deleted_at is null), true);
select test.ok(current_setting('t.rl') <> '', 'the member role has a KPIs level to retire');
select set_config('t.req', audit.begin('system', 'made_up.migration_retires_a_level')::text, true);
update core.role_page_level set deleted_at = core.clock(), delete_reason = 'made up: retired by a migration'
where id = current_setting('t.rl')::uuid;
select audit.end();

-- an admin removes a person's own override (a person's removal: the control)
select test.as_person(current_setting('t.admin')::uuid);
create function pg_temp.refusal(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'no refusal';
exception when others then
  return sqlstate || ' ' || sqlerrm;
end
$$;
select set_config('t.lv', api.access_set_person_level(current_setting('t.x')::uuid, 'reports', 'none',
  'made up: no reports') ->> 'id', true);
select api.access_clear_person_level(current_setting('t.x')::uuid, 'reports', 'made up: back to the role');

select test.ok(exists (select 1 from pg_catalog.jsonb_array_elements(api.recently_deleted(500)) x
                       where x ->> 'id' = current_setting('t.lv')),
  'Recently deleted lists what a person removed');
select test.ok(not exists (select 1 from pg_catalog.jsonb_array_elements(api.recently_deleted(500)) x
                           where x ->> 'id' = current_setting('t.rl')),
  'and never what the system retired');
select set_config('t.r', pg_temp.refusal(format('select api.restore(%L, %L, %L)', 'role_level',
  current_setting('t.rl'), 'made up: bring it back')), true);
select test.ok(current_setting('t.r') <> 'no refusal',
  'an admin''s restore of the retired level is refused — got ' || current_setting('t.r'));
select test.as_owner();
select test.ok((select deleted_at is not null from core.role_page_level where id = current_setting('t.rl')::uuid),
  'and the level stays retired');
