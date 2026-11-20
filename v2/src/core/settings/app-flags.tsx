'use client';
// The app-wide switches a piece of screen in the browser needs (Landing 34): today only whether Arabic is on, which
// decides whether the language choice is offered (the profile menu, the Arabic card in Settings). The (app) layout
// reads the settings on the server (getAppSettings) and hands them down here; after an admin saves the switch the
// page is refreshed, the layout answers again, and the choice appears — or goes — at once, with no reload.
import { createContext, use, type ReactNode } from 'react';

const Flags = createContext<{ arabicEnabled: boolean }>({ arabicEnabled: false });

export function AppFlagsProvider({ arabicEnabled, children }: { arabicEnabled: boolean; children: ReactNode }) {
  return <Flags value={{ arabicEnabled }}>{children}</Flags>;
}

/** Whether Arabic is on (Settings → App → Arabic): the language choice is offered only then. Off outside the app. */
export function useArabicEnabled(): boolean {
  return use(Flags).arabicEnabled;
}
