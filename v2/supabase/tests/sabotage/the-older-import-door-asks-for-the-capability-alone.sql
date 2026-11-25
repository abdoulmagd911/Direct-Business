-- Sabotage: the-older-import-door-asks-for-the-capability-alone
-- Breaks: sql:XTR-05
-- Expect: a person whose role became Viewer cannot import through the older door, whatever their record still says
-- The older import door goes back to asking for the capability alone, as before Landing 51: a setting left over on
-- a person whose role became Viewer lets them import.
CREATE OR REPLACE FUNCTION api.finance_import(p_file text, p_rows jsonb, p_export_time timestamp with time zone, p_file_name text DEFAULT NULL::text, p_sha256 text DEFAULT NULL::text, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  return finance.import_run(p_file, p_rows, p_export_time, p_file_name, p_sha256, p_dry_run);
exception when sqlstate 'P0001' then
  -- the preview: everything above was rolled back; its answer is in the message's detail
  declare
    m text; d text;
  begin
    get stacked diagnostics m = message_text, d = pg_exception_detail;
    if m = 'finance.import_dry_run' then
      return d::jsonb || '{"dry_run": true}'::jsonb;
    end if;
    raise;
  end;
end
$function$;
