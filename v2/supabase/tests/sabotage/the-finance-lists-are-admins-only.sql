-- Sabotage: the-finance-lists-are-admins-only
-- Breaks: sql:IMP-03
-- Expect: a head with Full on Finance keeps the map, without the Settings page
-- The products with no supplier cost, the channels and the import's column map sit behind the Settings page again, so
-- only an admin keeps them, not a person with Full on Finance (V621, V613, V622; brief I.9).
update core.entity set page_key = 'settings.finance' where key in ('product', 'channel', 'import_map');
