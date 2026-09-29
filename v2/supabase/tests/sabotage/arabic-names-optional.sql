-- Sabotage: arabic-names-optional
-- Breaks: sql:ROLE-01, sql:TEAM-01
-- Expect: needs its Arabic name
-- Departments, teams and roles are saved without an Arabic name (V97 requires one): the Arabic screens show blanks.
drop trigger name_ar_required on core.department;
drop trigger name_ar_required on core.team;
drop trigger name_ar_required on core.role;
