'use client';
import { useLinkStatus } from 'next/link';
import { cn } from '../cn';

/**
 * Inside a menu link (drawer, bottom bar, More): the moment the item is tapped it lights up and pulses until its page
 * arrives (owner, 13 Nov: "tap My day — it does not open, it just lags"). A screen is drawn on the server, so the new
 * page can only arrive once the server has answered; the tapped item answers at once instead of the screen looking
 * frozen. The top bar's pending line (NavProgress) runs as well. Presentation only: nothing about the page changes.
 * `className` places the light (by default it fills the link).
 */
export function NavPending({ className = 'absolute inset-0 rounded-[inherit]' }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      data-nav-pending-item
      className={cn('pointer-events-none bg-nav-active animate-pulse motion-reduce:animate-none', className)}
    />
  );
}
