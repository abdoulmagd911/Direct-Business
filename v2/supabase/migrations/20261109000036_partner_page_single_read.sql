-- FIX-45 (Landing 5): one server RPC serves the whole partner record page (diagnosis-fix45.md §5 item 1).
-- The record page used to make 16 separate serverRpc calls (partner, org, notes, contracts, record_history,
-- comments, files, company_summary, 8 lists) plus the file kinds (FIX-15, landed after this migration was
-- written), each its own HTTPS round trip through the gateway, with the partner
-- read awaited alone before the other 15 — so two ordinary 10 s gateway stalls on that spine cost ~20 s. One call
-- means one gateway exposure instead of sixteen, and one planning cost instead of sixteen.
--
-- Semantics kept exactly as the page read them:
-- - the card is read first and UNGUARDED: a missing partner raises common.not_found (P0002) and a refused one
--   access.needs_level, exactly as the old first read did — the page turns those into notFound / refused;
-- - the org and the nine lists are unguarded too, as before: a failure there failed the page;
-- - the ninth list is the file kinds (FIX-15): the Files section asks for a review date exactly when the kind
--   requires one, read live, never hard-coded, so an admin's change in Settings applies.
-- - the six partner sections (notes, contracts, history, comments, files, summary) are guarded, as the page's
--   maybe<> was: a failing section reads null, never a faked value.
-- No signature change to any existing function; one new function, granted to authenticated like its parts.
create function api.partner_page(p_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_card jsonb;
  v_org jsonb;
  v_notes jsonb;
  v_contracts jsonb;
  v_history jsonb;
  v_comments jsonb;
  v_files jsonb;
  v_summary jsonb;
  v_types jsonb;
  v_tiers jsonb;
  v_reasons jsonb;
  v_roles jsonb;
  v_activity_types jsonb;
  v_outcomes jsonb;
  v_systems jsonb;
  v_priorities jsonb;
  v_file_kinds jsonb;
begin
  v_card := api.partner(p_id);
  v_org := api.org();
  v_types := api.list('side_type');
  v_tiers := api.list('side_tier');
  v_reasons := api.list('side_status_reason');
  v_roles := api.list('contact_role');
  v_activity_types := api.list('activity_type');
  v_outcomes := api.list('activity_outcome');
  v_systems := api.list('ref_system');
  v_priorities := api.list('priority');
  v_file_kinds := api.list('file_kind');
  begin
    v_notes := api.notes('partner', p_id, null, 100);
  exception when others then
    v_notes := null;
  end;
  begin
    v_contracts := api.contracts(p_id);
  exception when others then
    v_contracts := null;
  end;
  begin
    v_history := api.record_history('partner', p_id);
  exception when others then
    v_history := null;
  end;
  begin
    v_comments := api.comments('partner', p_id);
  exception when others then
    v_comments := null;
  end;
  begin
    v_files := api.files('partner', p_id);
  exception when others then
    v_files := null;
  end;
  begin
    v_summary := api.company_summary(p_id);
  exception when others then
    v_summary := null;
  end;
  return pg_catalog.jsonb_build_object(
    'card', v_card,
    'org', v_org,
    'notes', v_notes,
    'contracts', v_contracts,
    'history', v_history,
    'comments', v_comments,
    'files', v_files,
    'summary', v_summary,
    'lists', pg_catalog.jsonb_build_object(
      'types', v_types,
      'tiers', v_tiers,
      'reasons', v_reasons,
      'roles', v_roles,
      'activityTypes', v_activity_types,
      'outcomes', v_outcomes,
      'systems', v_systems,
      'priorities', v_priorities,
      'fileKinds', v_file_kinds));
end
$$;

grant execute on function api.partner_page(uuid) to authenticated;
