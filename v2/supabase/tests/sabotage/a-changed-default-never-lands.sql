-- Sabotage: a-changed-default-never-lands
-- Breaks: sql:REG-01
-- Expect: every setting answers the registry's default today
-- A changed setting default never takes effect: only the first default ever written counts (V155).
update core.setting set deleted_at = now(), delete_reason = 'sabotage'
where reason = 'default' and valid_from > date '2000-01-01' and deleted_at is null;
