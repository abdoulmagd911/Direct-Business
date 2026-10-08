-- Sabotage: a-second-open-prepaid-id
-- Breaks: sql:IDN-06
-- Expect: a second open prepaid ID is refused
-- An organisation holds any number of open prepaid client IDs (V422).
drop trigger open_client_ids on partner.identifier;
