'use client';
// The language choice's one behaviour (Landing 34), shared by its places — the profile menu, My profile and the
// Arabic card in Settings → App: picking a language saves it to the person's profile (so every device matches) and
// asks for the page again, because the words come from the server in that language. It is offered only while Arabic
// is on (useArabicEnabled, core/settings/app-flags.tsx); while it is off everyone is answered in English.
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { MeAnswer } from '@/core/auth/me';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { toast } from '@/ui/Toast';
import { setPref, type Locale } from './index';

/**
 * The save behind a language pick: the profile is written at its current version first, and only a saved choice
 * changes the cookie and reloads — a save that fails leaves the screen in the language it is in, and says so.
 */
export async function saveLanguage(
  next: Locale,
  io: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    apply: (l: Locale) => void;
    reload: () => void;
    failed: (e: unknown) => void;
  },
): Promise<boolean> {
  try {
    const now = (await io.rpc('me', {})) as MeAnswer;
    const profile = now.status === 'ok' ? now.profile : null;
    await io.rpc('profile_update', {
      p_changes: { locale: next },
      p_version: profile?.version ?? undefined,
      p_person_version: undefined,
    });
  } catch (e) {
    io.failed(e);
    return false;
  }
  io.apply(next);
  io.reload();
  return true;
}

export function useLanguageChoice(): { locale: Locale; busy: boolean; choose: (next: Locale) => Promise<void> } {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const choose = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      setBusy(true);
      const saved = await saveLanguage(next, {
        rpc: rpc as never,
        apply: (l) => setPref('locale', l),
        reload: () => window.location.reload(),
        failed: (e) => {
          const { key, detail } = errorKey(e, (k) => t.has(k));
          toast.failed(t(key, { detail }));
        },
      });
      // a saved choice reloads the page; only a failed one stays here
      if (!saved) setBusy(false);
    },
    [locale, t],
  );
  return { locale, busy, choose };
}
