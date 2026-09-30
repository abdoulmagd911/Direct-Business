-- Sabotage: a-setting-without-its-floor-row
-- Breaks: sql:SETS-02
-- Expect: every setting answers from its own row at the floor date, not from its definition
-- The seeded defaults at the floor date are gone: a past day answers from whatever the definition says now (V155).
update core.setting set deleted_at = now(), delete_reason = 'sabotage'
where reason = 'default' and valid_from = date '2000-01-01' and deleted_at is null;
