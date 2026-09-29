-- Sabotage: two-partners-hold-one-phone
-- Breaks: sql:IDN-01
-- Expect: the same phone in another spelling is refused to a second partner
-- Nothing keeps a value on one partner: two partners hold one phone, and matching cannot choose.
drop index partner.identifier_one_holder;
