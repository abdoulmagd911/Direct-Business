import type { ReactNode } from 'react';
import { requireMe } from '@/core/auth/require-me';
import { PageFrame } from './AppShell';

/**
 * Every screen's outer element: the scrolling page area (PageFrame) after the gate has answered. A screen's content
 * is only drawn for an allowed person (A5) — Next draws a page beside its layout, so the screen awaits the same
 * cached api.me() as the layout; a refused session gets the redirect and nothing else.
 */
export async function Page({
  children,
  className,
  bare = false,
}: {
  children: ReactNode;
  className?: string;
  /** The screen draws its own PageFrame (a client screen, a record page): gate only. */
  bare?: boolean;
}) {
  await requireMe();
  return bare ? <>{children}</> : <PageFrame className={className}>{children}</PageFrame>;
}
