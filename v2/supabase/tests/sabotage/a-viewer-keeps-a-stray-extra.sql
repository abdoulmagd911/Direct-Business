-- Sabotage: a-viewer-keeps-a-stray-extra
-- Breaks: sql:XTR-04
-- Expect: a Viewer with a stray grant still holds no extra
-- The one reading of an extra forgets that a Viewer stays view-only: a grant row on a Viewer counts.
create or replace function core.extra_access(p_person uuid, p_capability text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return authz.can_of(p_person, p_capability);
end
$$;
