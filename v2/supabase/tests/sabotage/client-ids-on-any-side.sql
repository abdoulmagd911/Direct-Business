-- Sabotage: client-ids-on-any-side
-- Breaks: sql:SIDE-01
-- Expect: a client ID needs the Client side
-- Client IDs, codes and credit limits land on an organisation whatever its sides (the world before V98).
drop trigger client_side_only on partner.identifier;
drop trigger client_side_only on partner.credit_limit;
