'use client';
import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
 * From the click on a link to the arrival of the next page, a bar runs across the top of the app (W47): on a slow phone
 * a tab switch is never a frozen screen. It listens for the click itself, so it shows before anything is asked of the
 * network, and it clears when the address changes (or after 20 s, so it can never stay).
 */
export function NavProgress() {
  const t = useTranslations();
  const where = `${usePathname()}?${useSearchParams().toString()}`;
  // the address a click left: the bar shows for as long as we are still on it
  const [leftFrom, setLeftFrom] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      const anchor = e.target instanceof Element ? e.target.closest('a') : null;
      if (!leavesThisPage(anchor, e, window.location)) return;
      setLeftFrom(`${window.location.pathname}?${window.location.search.slice(1)}`);
      clearTimeout(timer);
      timer = setTimeout(() => setLeftFrom(null), 20_000);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      clearTimeout(timer);
    };
  }, []);
  return leftFrom === where ? <PendingBar label={t('common.loading')} /> : null;
}
