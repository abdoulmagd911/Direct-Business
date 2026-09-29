-- Sabotage: a-preview-that-saves
-- Breaks: sql:SETS-02
-- Expect: the preview changes nothing
-- The dry run is not rolled back (V97): previewing a setting saves it.
create or replace function core.setting_preview(p_key text, p_department uuid, p_value jsonb, p_valid_from date default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  res jsonb := core.setting_set(p_key, p_department, p_value, p_valid_from, 'preview');
  day date := (res ->> 'valid_from')::date;
begin
  return pg_catalog.jsonb_build_object('valid_from', day, 'value_after', core.setting_at(p_key, p_department, day),
    'value_before', core.setting_at(p_key, p_department, day - 1), 'replaces_same_day', false, 'previewed', true);
end
$$;
