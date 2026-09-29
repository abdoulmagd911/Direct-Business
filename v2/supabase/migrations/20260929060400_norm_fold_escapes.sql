-- v2 folding, its marks written as escapes (V137). The rule is the one of 20260929060000_norm.sql, unchanged: harakat
-- (U+064B to U+065F), the superscript alef (U+0670) and tatweel (U+0640) are removed. Only their spelling changes:
-- written as \u escapes, the text stays the same under Unicode normalization, so the cloud runs exactly this file.
-- The first copy reached the cloud with two marks reordered (U+0670 before U+065F), which stretched the removed range
-- to U+0670 and took the letters ٮ ٯ and the signs ٪ ٫ ٬ ٭ with it; this puts the cloud back on the rule.
-- norm.version() stays 1: the rule itself did not change. Forward-only (V103).
create or replace function norm.fold(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.replace(
      pg_catalog.regexp_replace(
        pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(t, 'NFKC')),
          'أإآٱىئةؤکی٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          'ااااييهوكي01234567890123456789'),
        '[\u064B-\u065F\u0670\u0640]', '', 'g'),
      '.', ''),
    '[^a-z0-9À-ɏء-غف-يٱ-ۓ]+', ' ', 'g')), '')
$$;
comment on function norm.fold(text) is 'The one folding of typed text (§3.5): NFKC, lower case, Arabic forms and digits, no marks, no dots.';

-- Keys stay true (A17): nothing to mend where the rule ran as written; on the cloud, any key the stretched range made.
select norm.rebuild();
