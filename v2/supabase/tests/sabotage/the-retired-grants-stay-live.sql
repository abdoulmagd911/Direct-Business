-- Sabotage: the-retired-grants-stay-live
-- Breaks: sql:ACC-09
-- Expect: no role and no person holds a live grant of a retired capability
-- The clean-up never ran: the grants of the retired partners capabilities are live again on the roles and people.
update core.role_capability set deleted_at = null, deleted_by = null, delete_reason = null
where delete_reason = 'V176: the capability is retired';
update core.person_capability set deleted_at = null, deleted_by = null, delete_reason = null
where delete_reason = 'V176: the capability is retired';
