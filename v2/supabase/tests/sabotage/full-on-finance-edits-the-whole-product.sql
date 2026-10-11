-- Sabotage: full-on-finance-edits-the-whole-product
-- Breaks: sql:FNS-01
-- Expect: but cannot change its commission flag, service or name, nor retire it
-- The whole product list moves to the finance page, so Full on Finance changes a product's commission flag, service and
-- name, not only its no-supplier-cost flag (QA-534).
update core.entity set page_key = 'finance' where key = 'product';
