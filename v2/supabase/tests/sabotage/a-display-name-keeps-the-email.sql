-- Sabotage: a-display-name-keeps-the-email
-- Breaks: sql:PROF-02
-- Expect: stays empty
-- The profile keeps whatever the box sends, so a browser-filled e-mail becomes the person's display name.
drop trigger person_profile_display_name_not_email on core.person_profile;
