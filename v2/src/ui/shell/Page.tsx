import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { requireMe } from '@/core/auth/require-me';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
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
  page,
  title,
}: {
  children: ReactNode;
  className?: string;
  /** The screen draws its own PageFrame (a client screen, a record page): gate only. */
  bare?: boolean;
  /** The registry page this screen belongs to: a person at level none on it gets the no-access state, never an empty
   *  screen (PRF-002/123 — M53); `title` names it. */
  page?: string;
  title?: string;
}) {
  const me = await requireMe();
  if (page && (me.levels[page] ?? 'none') === 'none') {
    const t = await getTranslations();
    const what = title ?? page;
    return (
      <PageFrame className={className}>
        <PageHeader title={what} />
        <DataState kind="no-access" what={what} message={t('state.noAccess', { what })} />
      </PageFrame>
    );
  }
  return bare ? <>{children}</> : <PageFrame className={className}>{children}</PageFrame>;
}
