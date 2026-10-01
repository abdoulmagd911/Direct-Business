-- Sabotage: a-rule-only-type-without-its-rule
-- Breaks: sql:NOTE-02
-- Expect: must name that rule
-- A record type may be marked rule-only without naming its rule, and then nobody at all sees its records (V183).
alter table core.entity drop constraint entity_rule_only_has_rule;
