-- Sabotage: a-word-term-takes-numbers
-- Breaks: sql:CTR-05
-- Expect: words on a number term are refused
-- A contract term takes words or numbers whatever its unit (V480).
drop trigger term_kind on partner.contract_term;
