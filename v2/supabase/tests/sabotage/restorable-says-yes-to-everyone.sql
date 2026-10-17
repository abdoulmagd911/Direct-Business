-- Sabotage: restorable-says-yes-to-everyone
-- Breaks: sql:DEL-03
-- Expect: a viewer sees it listed but is not offered Restore
-- The restore check answers yes for any record, so a viewer is offered a button that would be refused.
create or replace function core.can_restore(p_entity text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select true $$;
