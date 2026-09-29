-- Sabotage: two-people-share-an-email
-- Breaks: sql:SIGN-01
-- Expect: the same e-mail, in capitals, for another person
-- The allow-list loses its one-person-per-e-mail rule: two people could sign in as one.
drop index core.person_email_live;
