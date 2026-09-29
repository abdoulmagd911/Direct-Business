'use client';
import { useCallback, useEffect, useState } from 'react';
import { command, type CommandWords } from '@/core/commands/command';
import { onRefetch } from '@/core/commands/refetch';
import { rpc } from '@/core/db/rpc';

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
};

/**
 * The saved views of one page: read on mount and after every command; save (new or mine), set as my default, remove
 * (soft, restorable from Recently deleted — one request, one Undo).
 */
export function useSavedViews(page: string, words: CommandWords) {
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
    (v: { id?: string; name: string; query: Record<string, unknown>; shared: boolean; version?: number }) =>
      command(
        words,
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
      await rpc('view_default_set', { p_page: page, p_view: id });
      await load();
    },
    [page, load],
  );
  const remove = useCallback(
    (ids: string[], done: string) =>
      command(
        { ...words, done },
        () => rpc('views_remove', { p_ids: ids }) as Promise<{ request_id?: string | null } | null>,
      ),
    [words],
  );
  return { views, failed, reload: load, save, setDefault, remove };
}
