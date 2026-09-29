-- Sabotage: a-sign-in-link-is-deleted
-- Breaks: sql:UNDO-06
-- Expect: a sign-in link is never deleted
-- The guard on core.person_auth is gone: deleting a link, or its auth user, silently drops who the sign-in was.
drop trigger never_deleted on core.person_auth;
