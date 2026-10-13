-- Mutant m46-fold-forgets-ta-marbuta: folding no longer reads ة as ه
CREATE OR REPLACE FUNCTION norm.fold(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO ''
AS $function$
  select nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.replace(
      pg_catalog.regexp_replace(
        pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(t, 'NFKC')),
          'أإآٱىئؤکی٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          'ااااييوكي01234567890123456789'),
        '[\u064B-\u065F\u0670\u0640]', '', 'g'),
      '.', ''),
    '[^a-z0-9À-ɏء-غف-يٱ-ۓ]+', ' ', 'g')), '')
$function$
;
