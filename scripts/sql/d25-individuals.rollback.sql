-- Rollback of D25: the list is KEPT (never deleted — it holds who decided what), only no longer read by the app; the guard
-- keeps its wider name mapping (harmless: it only adds the 'name' key for this table).
select 1;
