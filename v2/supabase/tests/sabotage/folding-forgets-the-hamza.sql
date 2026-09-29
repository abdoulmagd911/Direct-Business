-- Sabotage: folding-forgets-the-hamza
-- Breaks: sql:NORM-01
-- Expect: أ folds to ا
-- Folding forgets the hamza forms: أرض and ارض are two words.
create or replace function norm.fold(t text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.replace(
      pg_catalog.regexp_replace(
        pg_catalog.translate(pg_catalog.lower(pg_catalog.normalize(t, 'NFKC')),
          'ىئةؤکی٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          'ييهوكي01234567890123456789'),
        '[ً-ٰٟـ]', '', 'g'),
      '.', ''),
    '[^a-z0-9À-ɏء-غف-يٱ-ۓ]+', ' ', 'g')), '')
$$;
