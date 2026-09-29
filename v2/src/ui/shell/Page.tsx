import type { ReactNode } from 'react';
import { requireMe } from '@/core/auth/require-me';
import { PageFrame } from './AppShell';

/**
 * Every screen's outer element: the scrolling page area (PageFrame) after the gate has answered. A screen's content
 * is only drawn for an allowed person (A5) — Next draws a page beside its layout, so the screen awaits the same
 * cached api.me() as the layout; a refused session gets the redirect and nothing else.
 */
export async function Page({ children, className }: { children: ReactNode; className?: string }) {
  await requireMe();
  return <PageFrame className={className}>{children}</PageFrame>;
}
