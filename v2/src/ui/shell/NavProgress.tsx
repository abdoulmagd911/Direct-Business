'use client';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { navLeftFrom, navSettled, navStarted, onNav } from './nav-pending';

type Click = Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'>;

/**
 * Whether a click on `anchor` moves to another address of this app (W47): a plain click on a link inside the app that
 * leads somewhere else — not a new tab, a download, a modified click or the page we are already on.
 */
export function leavesThisPage(
  anchor: Pick<HTMLAnchorElement, 'href' | 'target' | 'download'> | null,
  click: Click,
  here: { origin: string; pathname: string; search: string },
): boolean {
  if (!anchor || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.download) return false;
  let to: URL;
  try {
    to = new URL(anchor.href, here.origin);
  } catch {
    return false;
  }
  if (to.origin !== here.origin) return false;
  return to.pathname !== here.pathname || to.search !== here.search;
}

/** The bar itself, said to a screen reader too. */
export function PendingBar({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-nav-pending
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 animate-pulse bg-primary motion-reduce:animate-none"
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * The words of the wait, for the eye (Landing 34, item 10): a 4 px bar at the very top was easy to miss, and a tap on
 * the menu, a record link or a search result that takes the server a few seconds read as a tap that did nothing. Once a
 * move has taken 400 ms (`show-late`; at once with "reduce motion") a small pill under the top bar says Loading, in the
 * toast's own colours, until the page arrives. The bar above already says it to a screen reader, so this is for the eye.
 */
export function PendingPill({ label }: { label: string }) {
  return (
    <div
      aria-hidden="true"
      data-nav-pending-pill
      className="show-late pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-h)+0.5rem)] z-50 flex justify-center px-4"
    >
      <span className="inline-flex min-w-0 items-center gap-2 rounded-pill bg-inverse px-3.5 py-1.5 font-ui text-sm font-medium text-on-inverse shadow-2">
        <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
        <span className="truncate">{label}</span>
      </span>
    </div>
  );
}

/**
 * From the click on a link to the arrival of the next page, a bar runs across the top of the app (W47): on a slow phone
 * a tab switch is never a frozen screen. It listens for the click itself, so it shows before anything is asked of the
 * network, and it clears when the address changes (or after 20 s, so it can never stay). A move made in code (the
 * search's result, a row that opens its record) starts the same bar through `navStarted()` (nav-pending.ts): before
 * Landing 34 only a click on a link did, so a search result closed the search and showed nothing while its page was
 * read. After 400 ms the wait is also said in words (PendingPill).
 */
export function NavProgress() {
  const t = useTranslations();
  const where = `${usePathname()}?${useSearchParams().toString()}`;
  // the address a move left: the bar shows for as long as we are still on it
  const leftFrom = useSyncExternalStore(onNav, navLeftFrom, () => null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = e.target instanceof Element ? e.target.closest('a') : null;
      if (!leavesThisPage(anchor, e, window.location)) return;
      navStarted();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  // the next page has arrived: nothing is on its way any more (the focus refetch reads this, RefetchBridge)
  useEffect(() => {
    if (leftFrom !== null && leftFrom !== where) navSettled();
  }, [leftFrom, where]);
  if (leftFrom !== where) return null;
  const label = t('common.loading');
  return (
    <>
      <PendingBar label={label} />
      <PendingPill label={label} />
    </>
  );
}
