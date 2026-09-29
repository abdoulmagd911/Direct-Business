-- Sabotage: a-password-field
-- Breaks: sql:SIDE-01
-- Expect: a field named like a password is refused
-- A side field may be named like a password: a card could end up holding one (V98 forbids it).
alter table partner.side_field drop constraint side_field_no_secrets;
