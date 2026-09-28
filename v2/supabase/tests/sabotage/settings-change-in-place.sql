-- Sabotage: settings-change-in-place
-- Breaks: sql:SET-02
-- Expect: the value cannot be rewritten
-- A setting's value can be rewritten in place, losing its history (§3.2, §5a).
drop trigger guard on core.setting;
