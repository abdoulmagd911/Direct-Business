-- Phase 1a, step 2 — run ONLY AFTER the 1a pull request is merged and live.
-- Renames the stored level words: editor → full, viewer → view (own stays own; none is not stored).
-- Before the merge the live screen still reads 'editor'; after it, the screen reads my_page_levels()
-- and page_level() reads both words, so this step changes nobody's access — only the spelling.
-- Check before AND after with the LIVE-EQUIV query in docs (same effective access, 0 differences).
-- Undo: phase1a-rename-levels-rollback.sql.
update public.app_users u
   set page_access = coalesce((select jsonb_object_agg(e.key, public.level_word(e.value))
                                 from jsonb_each_text(u.page_access) e
                                where public.level_word(e.value) <> 'none'), '{}'::jsonb)
 where u.page_access is not null
   and exists (select 1 from jsonb_each_text(u.page_access) e where e.value in ('editor','viewer','none'));
