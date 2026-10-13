-- QA-143 — Each role starts at the spec's level on every page and with the spec's capabilities (TECH-SPEC §8 "Access
-- defaults"; D2, V125; the scenario catalogue's ACC-045, ACC-046, ACC-132 and PRF-001). The table below is §8's,
-- copied by hand: the Clients row stands for both clients and suppliers_partners and `partners.*` for the three
-- capabilities of each side (V147); files.restricted is V152's ("heads and managers hold by default"); the admin role
-- has each page's top level (V123) — Own on My profile, the only level it offers. A person of each of the five roles,
-- with no override, must read exactly these levels (authz.level_of) and hold exactly these capabilities
-- (authz.can_of); a page the registry has and §8 does not is named too, so a new page arrives with its row in §8.
-- Written by the QA auditor because REG-01 only compares the database with supabase/registry.json: a starting level
-- changed in a module.ts and synced (registry.json and the database moved together) passed the whole suite — a Head
-- at Full on Appraisal, a Manager without clients.identify, a viewer at none on My profile, a viewer at View on
-- Appraisal (QA-136, the catalogue's matrix mutants mx1, mx2, mx4, mx5). Guards: passes on v2/main today and goes red
-- under each of those, as a database change or as a synced source change. A deliberate change of a starting level
-- changes §8 and this table in the same PR. Made-up people only.
create temp table qa143_levels (page text, admin core.level, head core.level, manager core.level, member core.level,
                                viewer core.level);
insert into qa143_levels values
  ('my_day',               'full', 'full', 'full', 'own',  'view'),
  ('clients',              'full', 'full', 'full', 'full', 'view'),
  ('suppliers_partners',   'full', 'full', 'full', 'full', 'view'),
  ('finance',              'full', 'full', 'full', 'own',  'view'),
  ('overview',             'full', 'full', 'view', 'none', 'view'),
  ('pipeline',             'full', 'full', 'full', 'own',  'view'),
  ('projects',             'full', 'full', 'full', 'own',  'view'),
  ('tasks',                'full', 'full', 'full', 'own',  'view'),
  ('kpis',                 'full', 'full', 'full', 'own',  'view'),
  ('reports',              'full', 'full', 'view', 'view', 'view'),
  ('appraisal',            'full', 'own',  'own',  'own',  'none'),
  ('settings.profile',     'own',  'own',  'own',  'own',  'own'),
  ('settings.app',         'full', 'none', 'none', 'none', 'none'),
  ('settings.finance',     'full', 'none', 'none', 'none', 'none'),
  ('settings.org',         'full', 'none', 'none', 'none', 'none'),
  ('settings.partners',    'full', 'none', 'none', 'none', 'none'),
  ('settings.performance', 'full', 'none', 'none', 'none', 'none'),
  ('settings.work',        'full', 'none', 'none', 'none', 'none'),
  ('activity',             'full', 'view', 'view', 'none', 'none');

create temp table qa143_caps (capability text, roles text[]);
insert into qa143_caps values
  ('clients.identify',            '{admin,head,manager}'),
  ('clients.merge',               '{admin,head}'),
  ('clients.assign',              '{admin,head,manager}'),
  ('suppliers_partners.identify', '{admin,head,manager}'),
  ('suppliers_partners.merge',    '{admin,head}'),
  ('suppliers_partners.assign',   '{admin,head,manager}'),
  ('finance.credit_control',      '{admin,head}'),
  ('finance.import',              '{admin,head}'),
  ('finance.credit',              '{admin,head,manager}'),
  ('tasks.assign',                '{admin,head,manager}'),
  ('files.restricted',            '{admin,head,manager}'),
  ('org.sign_out',                '{admin}');

create temp table qa143_people (role text, person uuid);
insert into qa143_people values
  ('admin',   test.person('Test Admin QA143', 'admin')),
  ('head',    test.person('Test Head QA143', 'head')),
  ('manager', test.person('Test Manager QA143', 'manager')),
  ('member',  test.person('Test Member QA143', 'member')),
  ('viewer',  test.person('Test Viewer QA143', 'viewer'));

-- the setup reads back: five people, each on the seeded role of that key, none with an override
select test.eq((select count(*)::int from qa143_people x join core.person p on p.id = x.person
                join core.role r on r.id = p.role_id and r.key = x.role), 5, 'each made-up person holds the role of its key');
select test.eq((select count(*)::int from core.person_page_level l join qa143_people x on x.person = l.person_id), 0,
  'and no level override');
select test.eq((select count(*)::int from core.person_capability c join qa143_people x on x.person = c.person_id), 0,
  'and no capability override');

select test.eq((select string_agg(pg.key, ', ' order by pg.key) from core.page pg
                where pg.active and not exists (select 1 from qa143_levels e where e.page = pg.key)), null::text,
  'every page the registry has is a row of TECH-SPEC §8 (a new page brings its row)');
select test.eq((select string_agg(e.page, ', ' order by e.page) from qa143_levels e
                where not exists (select 1 from core.page pg where pg.key = e.page and pg.active)), null::text,
  'every page of §8 is in the registry');

select test.eq((
  select string_agg(format('%s on %s: %s, §8 says %s', x.role, e.page, authz.level_of(x.person, e.page), w.want), '; '
                    order by e.page, x.role)
  from qa143_levels e
  cross join qa143_people x
  cross join lateral (select case x.role when 'admin' then e.admin when 'head' then e.head when 'manager' then e.manager
                                         when 'member' then e.member else e.viewer end as want) w
  where authz.level_of(x.person, e.page) is distinct from w.want), null::text,
  'each role starts at TECH-SPEC §8''s level on every page');

select test.eq((select string_agg(c.key, ', ' order by c.key) from core.capability c
                where c.active and not exists (select 1 from qa143_caps e where e.capability = c.key)), null::text,
  'every capability the registry has is in §8 (or V152)');
select test.eq((
  select string_agg(format('%s %s %s', x.role, case when authz.can_of(x.person, e.capability) then 'holds' else 'lacks' end,
                           e.capability), '; ' order by e.capability, x.role)
  from qa143_caps e cross join qa143_people x
  where authz.can_of(x.person, e.capability) is distinct from (x.role = any (e.roles))), null::text,
  'each role starts with exactly TECH-SPEC §8''s capabilities');
