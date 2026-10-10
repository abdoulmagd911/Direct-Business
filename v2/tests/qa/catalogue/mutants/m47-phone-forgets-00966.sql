-- Mutant m47-phone-forgets-00966: a phone typed with 00966 keeps its prefix
CREATE OR REPLACE FUNCTION norm.phone_key(t text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
declare
  d text := pg_catalog.regexp_replace(coalesce(norm.fold(t), ''), '[^0-9]', '', 'g');
begin
  if d like '966%' then
    d := pg_catalog.substr(d, 4);
  end if;
  d := pg_catalog.ltrim(d, '0');
  return case when pg_catalog.length(d) >= 7 then d end;
end
$function$
;
