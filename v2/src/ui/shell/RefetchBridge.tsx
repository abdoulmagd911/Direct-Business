'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { lastRefetchAt, commandBusy, onRefetch, refetchAll } from '@/core/commands/refetch';
import { navPending } from './nav-pending';
import { PendingBar } from './NavProgress';

/** A window brought back after this long refetches (TECH-SPEC §2.4: focus refetch), never sooner. */
const FOCUS_AFTER_MS = 15_000;
/**
 * The focus refetch waits this long after the window comes back (Landing 34, item 10). The click that brings a window
 * back is very often a click on a link: the browser says "focus" at the press and "click" at the release, so the
 * refetch used to start a full re-read of the page being LEFT a moment before the move began — two reads of the slow
 * database racing each other, and the menu tap looked dead. Now the move goes first, and a page on its way cancels
 * the refetch of the one behind it.
 */
export const FOCUS_SETTLE_MS = 400;

/**
 * Turns the global refetch into the router's refresh (screens are server-rendered, so refreshing re-reads every
 * query they show), and asks for one when the window comes back into focus after a while — no timer, no polling.
 * The focus refetch never runs under a write (F131) or under a page that is on its way (Landing 34: FOCUS_SETTLE_MS).
 *
 * F-B1-03 / F-B5-06 / F-B5-08 / F-B6-03 (stale-read family): after a write the screen keeps showing the pre-write
 * server props until the refresh's re-read lands — 10–15 s when the gateway stalls a read — with nothing on screen
 * saying the data is not current yet. The refresh runs as a transition, so the top bar shows for exactly as long as
 * the fresh read is on its way and clears when the new props land: a healthy refresh flashes briefly, a stalled one
 * honestly stays. The bar is the one a navigation shows, and it changes no screen's data.
 *
 * The refresh round-trip is timed (timings only, no data — the counterpart of serverRpc's [serverRpc] log, which
 * times each read): the §5.9 repro needs the time from the refetch being asked for to the fresh props landing, and
 * nothing on the client measured it before.
 */
export function RefetchBridge() {
  const router = useRouter();
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const requestedAt = useRef(0);
  const wasPending = useRef(false);
  useEffect(() => {
    const off = onRefetch(() => {
      requestedAt.current = Date.now();
      startTransition(() => router.refresh());
    });
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (document.visibilityState !== 'visible') return;
        // a write is in flight: do not refresh under it (F131) — the focus refetch would re-read the record the
        // write is still changing, and a slow read during it threw the whole page.
        if (commandBusy()) return;
        // a page is on its way: it is read fresh when it lands, so the page being left is not read again under it
        if (navPending()) return;
        if (Date.now() - lastRefetchAt() < FOCUS_AFTER_MS) return;
        refetchAll();
      }, FOCUS_SETTLE_MS);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      off();
      clearTimeout(settle);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [router, startTransition]);
  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    console.log(`[refetch] ms=${Date.now() - requestedAt.current}`);
  }, [isPending]);
  return isPending ? <PendingBar label={t('common.loading')} /> : null;
}
