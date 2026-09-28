-- Sabotage: system-can-be-linked
-- Breaks: sql:ORG-02
-- Expect: no sign-in links to Import
-- The guard that keeps System and Import from ever being a login is gone (V44).
drop trigger guard on core.person_auth;
