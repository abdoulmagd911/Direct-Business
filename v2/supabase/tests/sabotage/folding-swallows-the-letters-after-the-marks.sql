-- Sabotage: folding-swallows-the-letters-after-the-marks
-- Breaks: sql:NORM-01
-- Expect: but not the letters and signs after them
-- The marks' range as the cloud first ran it (V137): two marks reordered, so the removed range reaches U+0670 and takes
-- the dotless letters and the Arabic percent and separator signs with it.
create or replace function norm.fold(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.replace(
      pg_catalog.regexp_replace(
        pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(t, 'NFKC')),
          'أإآٱىئةؤکی٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          'ااااييهوكي01234567890123456789'),
        '[\u064B-\u0670\u065F\u0640]', '', 'g'),
      '.', ''),
    '[^a-z0-9À-ɏء-غف-يٱ-ۓ]+', ' ', 'g')), '')
$$;
