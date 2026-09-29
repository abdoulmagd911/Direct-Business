'use client';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { toast } from '@/ui/Toast';

export type CommandWords = {
  /** The done line, e.g. "Saved" or "Ahmed switched off". */
  done: string;
  undo: string;
  /** The done line of the Undo itself, e.g. "Undone". */
  undone: string;
  /** Turns a refusal into words (next-intl's `t`, with `t.has`). */
  failed: (key: string, detail: string) => string;
  has: (key: string) => boolean;
};

export type Written = { request_id?: string | null } | null | undefined;

/**
 * One person action (TECH-SPEC §3.3, V128): run the write, then a toast with Undo (`api.undo(request)` — the whole
 * request, all or nothing) or the refusal in words. `after` runs on success (a refresh, a close). P3-7 grows this into
 * `command()` with the global refetch and the conflict dialog; screens call it the same way.
 */
export async function run<T extends Written>(
  words: CommandWords,
  write: () => Promise<T>,
  after?: (result: T) => void | Promise<void>,
): Promise<T | undefined> {
  try {
    const result = await write();
    const requestId = (result as { request_id?: string | null } | null)?.request_id ?? null;
    toast.done(words.done, {
      undo: requestId
        ? {
            label: words.undo,
            onUndo: async () => {
              try {
                await rpc('undo', { p_request: requestId });
                toast.done(words.undone);
                await after?.(result);
              } catch (e) {
                const { key, detail } = errorKey(e, words.has);
                toast.failed(words.failed(key, detail));
              }
            },
          }
        : undefined,
    });
    await after?.(result);
    return result;
  } catch (e) {
    const { key, detail } = errorKey(e, words.has);
    toast.failed(words.failed(key, detail));
    return undefined;
  }
}
