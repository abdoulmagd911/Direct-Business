// The language half of PrefsSync, as one rule that can be run without a browser (Landing 34b). The locale cookie is a
// cache of the language the person should read (personLocale, ./effective) — never a choice of its own — so it is
// brought in line with it; and when that language is not the one the page was loaded in, the page is asked for again,
// once, because the words come from the server.
import type { Locale } from './index';

export function followLanguage(
  /** The language the person should read (personLocale). */
  want: Locale,
  /** The language the page on screen was loaded in (the root layout's). */
  loadedIn: Locale,
  io: {
    /** The locale cookie as it stands. */
    cookie: Locale;
    set: (locale: Locale) => void;
    reload: () => void;
  },
): void {
  if (io.cookie !== want) io.set(want);
  // the page is in another language than the person should read: an admin has just turned Arabic on or off, or the
  // person came in from the sign-in page, which follows its own button. A page already in the right language is not
  // loaded a second time — a new device only gets its cookie written.
  if (loadedIn !== want) io.reload();
}
