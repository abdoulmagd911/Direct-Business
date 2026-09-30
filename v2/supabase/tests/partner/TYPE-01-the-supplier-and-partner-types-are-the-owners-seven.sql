-- TYPE-01 — the Supplier & partner types are the owner's seven (V180, V448; the production finding W12), in his order:
-- Hotel supplier · Airline · Visa/Embassy · Payment provider · Sales channel · Technology · Strategic partner, each
-- with its Arabic name; none of them retired, so every side keeps its type. The client types are untouched. Made up.
-- Sabotage: supabase/tests/sabotage/the-supplier-types-as-first-seeded.sql.
select test.eq((select string_agg(name_en, ' · ' order by sort) from partner.side_type
                where side = 'supplier_partner' and active),
  'Hotel supplier · Airline · Visa/Embassy · Payment provider · Sales channel · Technology · Strategic partner',
  'the Supplier & partner types are the owner''s seven, in his order');
select test.eq((select count(*)::int from partner.side_type
                where side = 'supplier_partner' and active and pg_catalog.btrim(name_ar) = ''), 0,
  'each with its Arabic name');
select test.eq((select count(*)::int from partner.side_type where side = 'supplier_partner' and not active), 0,
  'none of them is retired: the plain Supplier is the Hotel supplier now');
select test.eq((select string_agg(name_en, ' · ' order by sort) from partner.side_type
                where side = 'client' and active),
  'Government · Corporate · Agencies · Individuals', 'the client types are untouched');
