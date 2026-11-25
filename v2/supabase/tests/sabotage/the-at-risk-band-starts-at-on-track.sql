-- Sabotage: the-at-risk-band-starts-at-on-track
-- Breaks: sql:PCE-01
-- Expect: 89% is At risk
-- The At risk band has no room: anything under On track is Behind.
create or replace function perf.pace_bands() returns jsonb
language sql immutable security invoker set search_path = ''
as $$ select pg_catalog.jsonb_build_object('on_track', 90, 'at_risk', 90) $$;
