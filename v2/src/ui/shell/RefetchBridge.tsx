'use client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { lastRefetchAt, commandBusy, onRefetch, refetchAll } from '@/core/commands/refetch';
import { PendingBar } from './NavProgress';

/** A window brought back after this long refetches (TECH-SPEC §2.4: focus refetch), never sooner. */
const FOCUS_AFTER_MS = 15_000;

/**
 * Turns the global refetch into the router's refresh (screens are server-rendered, so refreshing re-reads every
 * query they show), and asks for one when the window comes back into focus after a while — no timer, no polling.
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
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      // a write is in flight: do not refresh under it (F131) — the focus refetch would re-read the record the
      // write is still changing, and a slow read during it threw the whole page.
      if (commandBusy()) return;
      if (Date.now() - lastRefetchAt() < FOCUS_AFTER_MS) return;
      refetchAll();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      off();
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
