'use client';
// The theme switcher's one behaviour (Landing 31, the theme-switcher rules board), shared by its three places — the
// five cards in My profile → Look, the profile menu on a PC and the phone's bottom sheet: picking a theme changes the
// whole app at once (no Save button, no reload) and saves it to the person's profile, so every device matches.
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { MeAnswer } from '@/core/auth/me';
import { rpc } from '@/core/db/rpc';
import { errorKey } from '@/core/db/words';
import { toast } from '@/ui/Toast';
import { readPrefs, readTheme, setPref, type Theme } from './index';

/**
 * The save behind a theme pick: the screen changes first (the cookie is the profile's cache), then the profile is
 * written at its current version — the switcher may be pressed twice in a row, from any page. A save that fails puts
 * the screen back to what the profile still says, and says so.
 */
export async function saveTheme(
  next: Theme,
  before: Theme,
  io: {
    apply: (t: Theme) => void;
    rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    refresh: () => void;
    failed: (e: unknown) => void;
  },
): Promise<boolean> {
  io.apply(next);
  try {
    const now = (await io.rpc('me', {})) as MeAnswer;
    const profile = now.status === 'ok' ? now.profile : null;
    await io.rpc('profile_update', {
      p_changes: { theme: next },
      p_version: profile?.version ?? undefined,
      p_person_version: undefined,
    });
    io.refresh();
    return true;
  } catch (e) {
    io.apply(readTheme(before) ?? 'light');
    io.failed(e);
    return false;
  }
}

export function useThemeChoice(): { theme: Theme; choose: (next: Theme) => Promise<void> } {
  const t = useTranslations();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(() => readPrefs().theme);
  useEffect(() => {
    const on = () => setTheme(readPrefs().theme);
    on();
    window.addEventListener('v2:prefs', on);
    return () => window.removeEventListener('v2:prefs', on);
  }, []);
  const choose = useCallback(
    async (next: Theme) => {
      const before = readPrefs().theme;
      if (next === before) return;
      await saveTheme(next, before, {
        apply: (th) => setPref('theme', th, { cache: true }),
        rpc: rpc as never,
        refresh: () => router.refresh(),
        failed: (e) => {
          const { key, detail } = errorKey(e, (k) => t.has(k));
          toast.failed(t(key, { detail }));
        },
      });
    },
    [router, t],
  );
  return { theme, choose };
}
