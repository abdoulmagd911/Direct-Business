'use client';
// V656: the owner's "Sign in as test user" switch, the browser side. The server decides everything (who may switch, to
// whom, no switching twice, no access change while switched); this only calls it, says a refusal in plain words and
// starts the app over as the person the session now is — `me` comes from the server gate, so a full load is the one
// way no screen keeps the other person's data.
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { MeAnswer } from '@/core/auth/me';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { readTheme, setPref } from '@/core/prefs';
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

/** The test switch (V656, D36(d), FIX-48): after a switch the new person's prefs are re-read at once, so the
 * switched-to user's theme applies on switch — the previous user's theme never survives into the new session. Only
 * the theme and density are applied here; the locale is rendered by the next full load, which re-reads it from the
 * server. A prefs read that fails never blocks the switch: the next load's PrefsSync is the fallback. */
async function applySwitchedPrefs(): Promise<void> {
  try {
    const answer = (await rpc('me', {})) as unknown as MeAnswer;
    if (answer.status !== 'ok' || !answer.profile) return;
    const theme = readTheme(answer.profile.theme);
    if (theme) setPref('theme', theme, { cache: true });
    const density = answer.profile.density;
    if (density === 'comfortable' || density === 'compact') setPref('density', density, { cache: true });
  } catch {
    // the switch still goes through; the next load re-reads the prefs from the server
  }
}

/** Switch this device to a TEST user, then start over on the start page. Throws the server's refusal, changing nothing. */
export async function switchStart(person: string, page: Starter = browser): Promise<void> {
  await rpc('test_switch_start', { p_person: person } as never);
  await applySwitchedPrefs();
  page.go(AFTER_SWITCH_PATH);
}

/** Back to my account, then reload so nothing of the TEST user stays on screen. Throws the server's refusal. */
export async function switchEnd(page: Starter = browser): Promise<void> {
  await rpc('test_switch_end', {} as never);
  await applySwitchedPrefs();
  page.reload();
}

/** The second step of a direct switch was refused: the device is back on its own account, and `cause` says why. */
export class SwitchedBack extends Error {
  constructor(public readonly refusal: unknown) {
    super('test_switch.switched_back');
  }
}

const END = 'test_switch_end' as const;

/**
 * Straight from one TEST user to another (Landing 34, item 29). The database lets nobody switch ON from inside a
 * switch (core.test_switch_start raises test_switch.already_switched — a rule of its own, with a database test), so
 * this makes the two steps it does allow, one after the other, each logged as before: back to my account, then Sign in
 * as the other TEST user. Both run as the real signed-in person, so who may start a switch is still the database's
 * call, unchanged. If the first step is refused nothing has changed and its refusal is thrown as it is; if the second
 * is, the device is on its own account again — `SwitchedBack` carries the refusal, and the caller starts the page over.
 */
export async function switchOver(person: string, page: Starter = browser): Promise<void> {
  await rpc(END, {} as never);
  try {
    await rpc('test_switch_start', { p_person: person } as never);
  } catch (e) {
    throw new SwitchedBack(e);
  }
  await applySwitchedPrefs();
  page.go(AFTER_SWITCH_PATH);
}

/** How long a refusal of the second step stays on screen before the page starts over on the owner's own account. */
export const SWITCHED_BACK_RELOAD_MS = 4000;

export function useTestSwitch() {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const attempt = useCallback(
    async (go: () => Promise<void>) => {
      setBusy(true);
      try {
        await go();
      } catch (e) {
        if (e instanceof SwitchedBack) {
          // the first step went through and the second was refused: say both, then start over as the owner — the
          // page still on screen is the TEST user's, and nothing on it is true any more
          const { key, detail } = errorKey(e.refusal, (k) => t.has(k));
          toast.failed(t('testSwitch.switchedBack', { reason: t(key, { detail }) }));
          setTimeout(() => browser.reload(), SWITCHED_BACK_RELOAD_MS);
          return;
        }
        const { key, detail } = errorKey(e, (k) => t.has(k));
        toast.failed(t(key, { detail }));
      } finally {
        // F-B6-01(e): the switch leaves the old page sitting there while the new one loads, and the buttons on
        // it are bound to `busy` — clearing it only on failure left every switch button disabled after a
        // switch that had already succeeded server-side. The server still refuses a second switch, so
        // re-enabling the buttons cannot double-apply one.
        setBusy(false);
      }
    },
    [t],
  );
  return {
    busy,
    start: (person: string) => attempt(() => switchStart(person)),
    end: () => attempt(() => switchEnd()),
    /** While switched: straight to another TEST user. */
    over: (person: string) => attempt(() => switchOver(person)),
  };
}
