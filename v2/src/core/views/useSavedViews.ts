'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { command, type CommandWords } from '@/core/commands/command';
import { onRefetch } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { toast } from '@/ui/Toast';

/** One saved view of a page (api.views — §3.3, V61, V78): personal, or shared with everyone who can open the page. */
export type SavedView = {
  id: string;
  name: string;
  query: Record<string, unknown>;
  shared: boolean;
  sort: number;
  owner_id: string;
  mine: boolean;
  default: boolean;
  version: number;
  /** Phase 5: a view that comes with the page, not one anyone saved — shown with the saved ones, never removable. */
  builtIn?: boolean;
};

/**
 * The views that come with a page (Phase 5): on Tasks, Starred (starred tasks) and Need help (flagged tasks, newest
 * flag first). They are seeded here, in the hook, so every screen that reads the page's views shows them; they are
 * not rows in api.views, so nobody can remove them or set one as their default by accident.
 * FIX-12 (D42): Mine — the tasks I own or am helping on, across all scope tabs (the My work scope).
 */
export const BUILT_IN_VIEWS: Record<string, { key: string; query: Record<string, unknown> }[]> = {
  tasks: [
    { key: 'starred', query: { starred: true } },
    { key: 'escalated', query: { escalated: true } },
    { key: 'mine', query: { scope: 'my_work' } },
  ],
};

/**
 * The saved views of one page: read on mount and after every command; save (new or mine), set as my default, remove
 * (soft, restorable from Recently deleted — one request, one Undo).
 */
export function useSavedViews(page: string, words: CommandWords) {
  const t = useTranslations();
  const [views, setViews] = useState<SavedView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    try {
      setViews(((await rpc('views', { p_page: page })) as unknown as SavedView[]) ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [page]);
  useEffect(() => {
    queueMicrotask(() => void load());
    return onRefetch(() => void load());
  }, [load]);

  const save = useCallback(
    (
      v: { id?: string; name: string; query: Record<string, unknown>; shared: boolean; version?: number },
      done?: string,
    ) =>
      command(
        { ...words, done: done ?? words.done },
        () =>
          rpc('view_save', {
            p_id: (v.id ?? null) as unknown as string,
            p_page: page,
            p_name: v.name,
            p_query: v.query as never,
            p_shared: v.shared,
            p_version: v.version,
          }) as Promise<{ id?: string; request_id?: string | null } | null>,
      ),
    [page, words],
  );
  const setDefault = useCallback(
    async (id: string) => {
      try {
        await rpc('view_default_set', { p_page: page, p_view: id });
      } catch (e) {
        // a failed "open this view first" is said, never silent (QA-74)
        const { key, detail } = errorKey(e, words.has);
        toast.failed(words.failed(key, detail));
        return;
      }
      await load();
    },
    [page, load, words],
  );
  const remove = useCallback(
    (ids: string[], done: string) =>
      command(
        { ...words, done },
        () => rpc('views_remove', { p_ids: ids }) as Promise<{ request_id?: string | null } | null>,
      ),
    [words],
  );
  // the page's own views first, then the ones anyone saved (a built-in is never removable, so it carries no menu)
  const builtIn: SavedView[] = (BUILT_IN_VIEWS[page] ?? []).map((b, i) => ({
    id: b.key,
    name: t(`pages.${page}.views.${b.key}`),
    query: b.query,
    shared: true,
    sort: -100 + i,
    owner_id: '',
    mine: false,
    default: false,
    version: 0,
    builtIn: true,
  }));
  return { views: views === null ? null : [...builtIn, ...views], failed, reload: load, save, setDefault, remove };
}
