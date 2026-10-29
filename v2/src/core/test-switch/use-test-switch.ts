'use client';
// V656: the owner's "Sign in as test user" switch, the browser side. The server decides everything (who may switch, to
// whom, no switching twice, no access change while switched); this only calls it, says a refusal in plain words and
// starts the app over as the person the session now is — `me` comes from the server gate, so a full load is the one
// way no screen keeps the other person's data.
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { toast } from '@/ui/Toast';

/** Where the app starts again after a switch: the start page, since the other person may not reach this one. */
export const AFTER_SWITCH_PATH = '/';

/** How the page starts over: kept apart so a test can watch it. */
export interface Starter {
  go: (path: string) => void;
  reload: () => void;
}
const browser: Starter = {
  go: (path) => window.location.assign(new URL(path, window.location.origin).href),
  reload: () => window.location.reload(),
};

/** Switch this device to a TEST user, then start over on the start page. Throws the server's refusal, changing nothing. */
export async function switchStart(person: string, page: Starter = browser): Promise<void> {
  await rpc('test_switch_start', { p_person: person } as never);
  page.go(AFTER_SWITCH_PATH);
}

/** Back to my account, then reload so nothing of the TEST user stays on screen. Throws the server's refusal. */
export async function switchEnd(page: Starter = browser): Promise<void> {
  await rpc('test_switch_end', {} as never);
  page.reload();
}

export function useTestSwitch() {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const attempt = useCallback(
    async (go: () => Promise<void>) => {
      setBusy(true);
      try {
        await go();
      } catch (e) {
        const { key, detail } = errorKey(e, (k) => t.has(k));
        toast.failed(t(key, { detail }));
        setBusy(false);
      }
    },
    [t],
  );
  return {
    busy,
    start: (person: string) => attempt(() => switchStart(person)),
    end: () => attempt(() => switchEnd()),
  };
}
