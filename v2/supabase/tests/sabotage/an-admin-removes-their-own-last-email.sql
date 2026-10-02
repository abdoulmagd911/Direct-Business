-- Sabotage: an-admin-removes-their-own-last-email
-- Breaks: sql:SIGN-12
-- Expect: an admin cannot remove their own last allowed e-mail
-- An admin may remove their own last allowed e-mail and lock themselves out (QA-208).
drop trigger keep_own_last on core.person_email;
