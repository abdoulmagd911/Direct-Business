-- Sabotage: a-mailbox-that-is-no-address
-- Breaks: sql:XREF-02
-- Expect: a mailbox that is not an address
-- Where a portal's codes go takes any words, not an address (V484).
alter table partner.reference drop constraint reference_code_mailbox;
