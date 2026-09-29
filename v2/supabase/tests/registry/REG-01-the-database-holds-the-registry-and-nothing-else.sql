-- REG-01 — the database holds the registry and nothing else (TECH-SPEC §2.3, V123): on a database built from zero, the
-- active pages, capabilities, setting definitions and record types (V127) are exactly supabase/registry.json's, the
-- five roles exist, each role starts at the registry's level on every page and with its capabilities, and every
-- setting has its default as a dated company-wide row. The old app registered a page in three places and a finance
-- page sat unreachable for two days; here a module.ts changed without `pnpm registry:sync` fails the unit test, and a
-- sync that lost something fails this. Sabotage: supabase/tests/sabotage/a-page-left-out-of-the-sync.sql.
do $$
declare
  reg jsonb := (select doc from test.registry_expected);
begin
  perform test.ok(reg is not null, 'supabase/registry.json was loaded');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('key', key, 'module', module, 'route', route, 'nav_group', nav_group,
                                         'nav_order', nav_order, 'levels', to_jsonb(levels_allowed))
                      order by key collate "C") from core.page where active),
    (select jsonb_agg(p order by p ->> 'key' collate "C") from jsonb_array_elements(reg -> 'pages') p),
    'the pages are the registry''s');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('key', key, 'page', page_key) order by key collate "C")
     from core.capability where active),
    (select jsonb_agg(c order by c ->> 'key' collate "C") from jsonb_array_elements(reg -> 'capabilities') c),
    'the capabilities are the registry''s');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('key', key, 'group', group_page, 'label', label_key, 'schema', schema,
                                         'default', default_value, 'effective_dated', effective_dated)
                      order by key collate "C") from core.setting_def where active),
    (select jsonb_agg(s order by s ->> 'key' collate "C") from jsonb_array_elements(reg -> 'settings') s),
    'the setting definitions are the registry''s');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('key', key, 'table', table_name, 'page', page_key, 'owners', owners)
                      order by key collate "C") from core.entity where active),
    (select jsonb_agg(e order by e ->> 'key' collate "C") from jsonb_array_elements(reg -> 'entities') e),
    'the record types are the registry''s');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('key', key, 'name_en', name_en, 'name_ar', name_ar, 'sort', sort,
                                         'is_admin', is_admin) order by key collate "C") from core.role),
    (select jsonb_agg(r order by r ->> 'key' collate "C") from jsonb_array_elements(reg -> 'roles') r),
    'the five roles, as seeded');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('role', r.key, 'page', l.page_key, 'level', l.level)
                      order by r.key collate "C", l.page_key collate "C")
     from core.role_page_level l join core.role r on r.id = l.role_id join core.page pg on pg.key = l.page_key
     where l.deleted_at is null and pg.active),
    (select jsonb_agg(x order by x ->> 'role' collate "C", x ->> 'page' collate "C")
     from jsonb_array_elements(reg -> 'role_levels') x),
    'each role starts at the registry''s level on every page');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('role', r.key, 'capability', c.capability_key, 'granted', c.granted)
                      order by r.key collate "C", c.capability_key collate "C")
     from core.role_capability c join core.role r on r.id = c.role_id where c.deleted_at is null),
    (select jsonb_agg(x order by x ->> 'role' collate "C", x ->> 'capability' collate "C")
     from jsonb_array_elements(reg -> 'role_capabilities') x),
    'each role starts with the registry''s capabilities');
  perform test.eq(
    (select jsonb_agg(jsonb_build_object('key', key, 'value', value) order by key collate "C")
     from core.setting where department_id is null and reason = 'default' and deleted_at is null),
    (select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'value', s -> 'default') order by s ->> 'key' collate "C")
     from jsonb_array_elements(reg -> 'settings') s),
    'every setting has its default as a dated company-wide row');
end $$;
