-- Sabotage: decision-is-no-activity-type
-- Breaks: sql:PST-02
-- Expect: a decision is logged as an activity of its own type
-- A decision taken with an organisation has no activity type of its own (V478).
update partner.activity_type set active = false where key = 'decision';
