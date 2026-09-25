-- Undo phase1a-rename-levels.sql: full → editor, view → viewer ('own' has no old word and is kept).
update public.app_users u
   set page_access = (select jsonb_object_agg(e.key, case e.value when 'full' then 'editor' when 'view' then 'viewer' else e.value end)
                        from jsonb_each_text(u.page_access) e)
 where u.page_access is not null and u.page_access <> '{}'::jsonb;
