-- Sabotage: the-channels-are-admins-only
-- Breaks: sql:FRD-03
-- Expect: Full on Finance, not an admin, adds and edits the two Finance lists
-- The channels sit behind the Settings page again, so only an admin keeps them, not a person with Full on Finance
-- (V627, V613; QA-539).
update core.entity set page_key = 'settings.finance' where key = 'channel';
