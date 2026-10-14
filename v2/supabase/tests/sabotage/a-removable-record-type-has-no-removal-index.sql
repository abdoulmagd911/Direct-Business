-- Sabotage: a-removable-record-type-has-no-removal-index
-- Breaks: sql:DEL-03
-- Expect: every record type that can be removed has an index on when it was removed
-- Contacts lose their index on when they were removed, so finding the removed ones reads every contact.
drop index partner.contact_removed_at;
