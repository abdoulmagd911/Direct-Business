-- Sabotage: a-campaign-code-and-a-partner-code-overlap
-- Breaks: sql:CODE-01
-- Expect: a code live on a campaign is refused to a partner for the same dates
-- A partner may take a code a campaign holds for the same dates: its invoices would count twice.
drop trigger code_guard on partner.identifier;
