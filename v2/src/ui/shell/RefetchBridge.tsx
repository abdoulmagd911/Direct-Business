'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { lastRefetchAt, onRefetch, refetchAll } from '@/core/commands/refetch';

/** A window brought back after this long refetches (TECH-SPEC §2.4: focus refetch), never sooner. */
const FOCUS_AFTER_MS = 15_000;

/**
 * Turns the global refetch into the router's refresh (screens are server-rendered, so refreshing re-reads every
 * query they show), and asks for one when the window comes back into focus after a while — no timer, no polling.
 */
export function RefetchBridge() {
  const router = useRouter();
  useEffect(() => {
    const off = onRefetch(() => router.refresh());
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
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
  }, [router]);
  return null;
}
