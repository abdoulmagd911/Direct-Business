-- Sabotage: the-record-read-works-out-the-money-again
-- Breaks: sql:PRT-02
-- Expect: the page read leaves the summary to its own read
-- The partner record read works out the money summary itself again.
create or replace function api.partner_page(p_id uuid) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_card jsonb;
  v_org jsonb;
  v_notes jsonb;
  v_contracts jsonb;
  v_history jsonb;
  v_comments jsonb;
  v_files jsonb;
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
  return pg_catalog.jsonb_build_object(
    'card', v_card,
    'org', v_org,
    'notes', v_notes,
    'contracts', v_contracts,
    'history', v_history,
    'comments', v_comments,
    'files', v_files,
    'summary', api.company_summary(p_id),
    'summary_deferred', true,
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
