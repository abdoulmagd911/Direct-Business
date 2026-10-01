-- Sabotage: the-supplier-types-as-first-seeded
-- Breaks: sql:TYPE-01
-- Expect: the Supplier & partner types are the owner's seven, in his order
-- The Supplier & partner types stay as P3-8b-1 seeded them: Supplier, Strategic partner, Sales channel, Integration,
-- Payment solution.
update partner.side_type set active = false where side = 'supplier_partner' and key in ('airline', 'visa_embassy');
update partner.side_type set name_en = 'Supplier', sort = 10 where side = 'supplier_partner' and key = 'supplier';
update partner.side_type set name_en = 'Payment solution', sort = 50 where side = 'supplier_partner' and key = 'payment_solution';
update partner.side_type set name_en = 'Integration', sort = 40 where side = 'supplier_partner' and key = 'integration';
update partner.side_type set sort = 20 where side = 'supplier_partner' and key = 'strategic_partner';
update partner.side_type set sort = 30 where side = 'supplier_partner' and key = 'sales_channel';
